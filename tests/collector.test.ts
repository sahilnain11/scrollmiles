// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDate } from '../src/analytics/metrics';
import type { Checkpoint, Settings } from '../src/types';

vi.mock('wxt/utils/define-content-script', () => ({ defineContentScript: (options: unknown) => options }));

let settings: Settings;
let checkpoints: Checkpoint[];
let attempts: number;
let failSends: boolean;
let onChanged: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
const cleanups: (() => void)[] = [];

async function initialize() {
  vi.resetModules();
  const { default: content } = await import('../entrypoints/content');
  const script = content as unknown as { main(ctx: {
    isValid: boolean; isInvalid: boolean;
    addEventListener(target: EventTarget, name: string, callback: EventListener, options?: AddEventListenerOptions): void;
    setTimeout(callback: () => void, delay: number): void;
    onInvalidated(callback: () => void): void;
  }): void };
  script.main({
    isValid: true, isInvalid: false,
    addEventListener(target, name, callback, options) {
      target.addEventListener(name, callback, options);
      cleanups.push(() => target.removeEventListener(name, callback, options));
    },
    setTimeout(callback, delay) { setTimeout(callback, delay); },
    onInvalidated(callback) { cleanups.push(callback); },
  });
  await Promise.resolve();
}

function scroll(y: number) {
  document.documentElement.scrollTop = y;
  document.dispatchEvent(new Event('scroll'));
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 11, 12));
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  Object.defineProperty(document, 'scrollingElement', { configurable: true, value: document.documentElement });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 100_000 });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 1_000 });
  document.documentElement.scrollTop = 0;
  settings = {
    trackingEnabled: true, allSitesEnabled: true, approvedSites: [], excludedSites: [],
    siteInsightsEnabled: false, siteInsightsSince: null,
    epoch: crypto.randomUUID(), theme: 'dark',
  };
  checkpoints = [];
  attempts = 0;
  failSends = false;
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; checkpoint?: Checkpoint }) => {
        if (message.type === 'GET_SETTINGS') return { ok: true, data: structuredClone(settings) };
        attempts += 1;
        if (failSends) throw new Error('Temporary worker/storage failure.');
        checkpoints.push(structuredClone(message.checkpoint!));
        return { ok: true, data: { accepted: true } };
      },
    },
    storage: { onChanged: {
      addListener: (listener: typeof onChanged) => { onChanged = listener; },
      removeListener: vi.fn(),
    } },
  });
  // happy-dom defaults to localhost: use a supported HTTP origin for policy.
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL('http://example.test/fixture');
  await initialize();
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('collector clock and retry beta checks (simulated)', () => {
  it('starts fresh hourly checkpoints only after opt-in and does not send hostnames', async () => {
    scroll(500);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints[0]?.hour).toBeUndefined();
    settings = { ...settings, epoch: crypto.randomUUID(), siteInsightsEnabled: true, siteInsightsSince: Date.now() };
    onChanged({ settings: { newValue: settings } }, 'local');
    scroll(800);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints[1]?.hour).toBe(12);
    expect(checkpoints[1]?.distancePx).toBe(300);
    expect(JSON.stringify(checkpoints)).not.toContain('example.test');
  });

  it('keeps continuous burst counts correct across hourly batches and sends only dirty hours', async () => {
    settings = { ...settings, epoch: crypto.randomUUID(), siteInsightsEnabled: true, siteInsightsSince: Date.now() };
    onChanged({ settings: { newValue: settings } }, 'local');
    vi.setSystemTime(new Date(2026, 10, 11, 12, 59, 59, 500));
    scroll(500);
    await vi.advanceTimersByTimeAsync(500);
    scroll(800);
    await vi.advanceTimersByTimeAsync(501);
    expect(checkpoints.map(({ hour, distancePx, actions, activeMs }) => ({ hour, distancePx, actions, activeMs }))).toEqual([
      { hour: 12, distancePx: 500, actions: 1, activeMs: 500 },
      { hour: 13, distancePx: 300, actions: 0, activeMs: 0 },
    ]);
    await vi.advanceTimersByTimeAsync(3000);
    scroll(900);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints).toHaveLength(3);
    expect(checkpoints[2]?.hour).toBe(13);
    expect(checkpoints[2]?.distancePx).toBe(400);
  });

  it('flushes both calendar days when midnight occurs before the scheduled batch', async () => {
    vi.setSystemTime(new Date(2026, 10, 11, 23, 59, 59, 500));
    scroll(500);
    vi.setSystemTime(new Date(2026, 10, 12, 0, 0, 0, 200));
    scroll(800);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints.map(({ date, distancePx }) => ({ date, distancePx }))).toEqual([
      { date: '2026-11-11', distancePx: 500 },
      { date: '2026-11-12', distancePx: 300 },
    ]);
    expect(new Set(checkpoints.map((checkpoint) => checkpoint.streamId)).size).toBe(2);
  });

  it('keeps cumulative counters monotonic when the same-day wall clock rolls backwards', async () => {
    scroll(500);
    await vi.advanceTimersByTimeAsync(1_001);
    vi.setSystemTime(new Date(2026, 10, 11, 8));
    scroll(800);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints.at(-1)?.distancePx).toBe(800);
    expect(checkpoints.at(-1)?.sequence).toBe(2);
    expect(checkpoints.at(-1)?.date).toBe('2026-11-11');
    expect(checkpoints.at(-1)!.activeMs).toBeGreaterThanOrEqual(0);
  });

  it('bounds automatic retries and retains unsent counters for the next scroll', async () => {
    failSends = true;
    scroll(500);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(attempts).toBe(4); // First attempt + three retries, no forever timer.
    expect(vi.getTimerCount()).toBe(0);
    failSends = false;
    scroll(800);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints.at(-1)?.distancePx).toBe(800);
  });

  it('does not reintroduce a paused buffer after a policy epoch change', async () => {
    scroll(500);
    settings = { ...settings, epoch: crypto.randomUUID(), trackingEnabled: false };
    onChanged({ settings: { newValue: settings } }, 'local');
    scroll(900);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints).toEqual([]);
    settings = { ...settings, epoch: crypto.randomUUID(), trackingEnabled: true };
    onChanged({ settings: { newValue: settings } }, 'local');
    scroll(1100);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(checkpoints.at(-1)?.distancePx).toBe(200);
  });

  it('excludes new scrolls immediately after an exclusion update', async () => {
    scroll(200);
    await vi.advanceTimersByTimeAsync(1_001);
    settings = { ...settings, epoch: crypto.randomUUID(), excludedSites: ['http://example.test'] };
    onChanged({ settings: { newValue: settings } }, 'local');
    scroll(900);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]?.distancePx).toBe(200);
  });

  it('does not create worker messages while the page is idle', async () => {
    await vi.advanceTimersByTimeAsync(60 * 60 * 1_000);
    expect(attempts).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(localDate()).toBe('2026-11-11');
  });
});