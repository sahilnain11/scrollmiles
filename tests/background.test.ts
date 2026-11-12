import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysAgo, localDate } from '../src/analytics/metrics';
import { openStatsDatabase, type StatsConnection } from '../src/storage/database';
import type { Checkpoint, Response, Settings, Snapshot } from '../src/types';

const state = vi.hoisted(() => ({ db: undefined as StatsConnection | undefined, failOpen: false }));
vi.mock('wxt/utils/define-background', () => ({ defineBackground: (main: () => void) => main }));
vi.mock('../src/storage/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/storage/database')>();
  return {
    ...actual,
    openStatsDatabase: (name?: string) => name ? actual.openStatsDatabase(name)
      : state.failOpen ? Promise.reject(new Error('Local database could not be opened.')) : Promise.resolve(state.db!),
  };
});

type Handler = (message: unknown, sender: chrome.runtime.MessageSender, respond: (response: Response<unknown>) => void) => boolean;
let handler: Handler;
let settings: Settings;
let granted: Set<string>;
let registrations: chrome.scripting.RegisteredContentScript[];
let onRemoved: () => void;
const id = 'test-scrollmiles';
const ui: chrome.runtime.MessageSender = { id, url: `chrome-extension://${id}/options.html` };
const collector: chrome.runtime.MessageSender = { id, url: 'https://example.com/private?q=never-save', frameId: 0, tab: { id: 1, incognito: false } as chrome.tabs.Tab };

async function request<T = unknown>(message: unknown, sender = ui): Promise<Response<T>> {
  return new Promise((resolve) => handler(message, sender, (response) => resolve(response as Response<T>)));
}

function checkpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    epoch: settings.epoch, streamId: crypto.randomUUID(), sequence: 1, date: localDate(),
    timezone: 'UTC', recordedAt: Date.now(), distancePx: 500, actions: 1, activeMs: 200,
    ...overrides,
  };
}

beforeEach(async () => {
  state.failOpen = false;
  state.db = await openStatsDatabase(`background-${crypto.randomUUID()}`);
  settings = { trackingEnabled: true, approvedSites: ['https://example.com'], allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null, theme: 'dark', epoch: crypto.randomUUID() };
  granted = new Set(['https://example.com/*']);
  registrations = [];
  const noopEvent = { addListener: vi.fn() };
  vi.stubGlobal('chrome', {
    runtime: {
      id, getURL: (file: string) => `chrome-extension://${id}/${file}`,
      onMessage: { addListener: (listener: Handler) => { handler = listener; } },
      onInstalled: noopEvent, onStartup: noopEvent,
    },
    storage: { local: {
      get: async () => ({ settings: structuredClone(settings) }),
      set: async (value: { settings: Settings }) => { settings = structuredClone(value.settings); },
    } },
    permissions: {
      contains: async ({ origins }: { origins: string[] }) => origins.every((origin) => granted.has(origin) || granted.has(`${new URL(origin).protocol}//*/*`)),
      remove: async ({ origins }: { origins: string[] }) => {
        for (const origin of origins) {
          for (const current of granted) if (current === origin || (origin.includes('://*') && current.startsWith(new URL(origin).protocol))) granted.delete(current);
        }
        return true;
      },
      onRemoved: { addListener: (listener: () => void) => { onRemoved = listener; } },
    },
    scripting: {
      getRegisteredContentScripts: async () => structuredClone(registrations),
      registerContentScripts: async (scripts: chrome.scripting.RegisteredContentScript[]) => { registrations = structuredClone(scripts); },
      updateContentScripts: async (scripts: chrome.scripting.RegisteredContentScript[]) => { registrations = structuredClone(scripts); },
      unregisterContentScripts: async () => { registrations = []; },
      executeScript: vi.fn(),
    },
    tabs: { query: async () => [] },
  });
  vi.resetModules();
  const { default: main } = await import('../entrypoints/background');
  (main as unknown as () => void)();
  // This request joins the serialized queue after startup reconciliation.
  const ready = await request({ type: 'GET_SNAPSHOT' });
  expect(ready.ok).toBe(true);
});

afterEach(() => {
  state.db?.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('background authorization and lifecycle', () => {
  it('provides retained anonymous history only when requested by authorized UI and preserves deletion boundaries', async () => {
    for (let index = 0; index <= 91; index++) await state.db!.put('days', { date: daysAgo(index), distancePx: 100, actions: 1, activeMs: 0 });
    const ordinary = await request<Snapshot>({ type: 'GET_SNAPSHOT' });
    expect(ordinary.ok && ordinary.data.history).toBeUndefined();
    const result = await request<Snapshot>({ type: 'GET_SNAPSHOT', includeHistory: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.capabilities?.retainedHistory).toBe(true);
    expect(result.data.history?.days).toHaveLength(90);
    expect(result.data.history?.startDate).toBe(daysAgo(89));
    expect(result.data.history?.endDate).toBe(localDate());
    expect(result.data.days).toHaveLength(7);
    expect(result.data.comparisonDays).toHaveLength(14);
    expect(result.data.siteHours).toEqual([]);
    expect(JSON.stringify(result.data.history)).not.toContain('example.com');
    expect((await request({ type: 'GET_SNAPSHOT', includeHistory: true }, collector)).ok).toBe(false);
    expect((await request({ type: 'GET_SNAPSHOT', includeHistory: 'all' })).ok).toBe(false);
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    await request({ type: 'DELETE_SITE_INSIGHTS', site: 'https://example.com' });
    await request({ type: 'SET_SITE_INSIGHTS', enabled: false });
    const preserved = await request<Snapshot>({ type: 'GET_SNAPSHOT', includeHistory: true });
    expect(preserved.ok && preserved.data.history?.days).toHaveLength(90);
    await request({ type: 'CLEAR_DATA' });
    const cleared = await request<Snapshot>({ type: 'GET_SNAPSHOT', includeHistory: true });
    expect(cleared.ok && cleared.data.history?.days).toEqual([]);
  });
  it('returns bounded anonymous comparison history without expanding the seven-day or opted-out detail view', async () => {
    for (let index = 0; index <= 16; index++) await state.db!.put('days', { date: daysAgo(index), distancePx: 100, actions: 1, activeMs: 0 });
    const result = await request<Snapshot>({ type: 'GET_SNAPSHOT' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.capabilities?.smartInsights).toBe(true);
    expect(result.data.days).toHaveLength(7);
    expect(result.data.comparisonDays).toHaveLength(14);
    expect(result.data.comparisonDays?.[0]?.date).toBe(daysAgo(14));
    expect(result.data.comparisonDays?.at(-1)?.date).toBe(daysAgo(1));
    expect(result.data.siteHours).toEqual([]);
    expect(JSON.stringify(result.data.comparisonDays)).not.toContain('example.com');
    expect((await request({ type: 'GET_SNAPSHOT' }, collector)).ok).toBe(false);
    await request({ type: 'CLEAR_DATA' });
    const cleared = await request<Snapshot>({ type: 'GET_SNAPSHOT' });
    expect(cleared.ok && cleared.data.comparisonDays).toEqual([]);
  });
  it('accepts known extension UI pages with section anchors and query parameters', async () => {
    for (const page of ['popup.html', 'dashboard.html', 'options.html']) {
      for (const suffix of ['#website-insights', '?view=details#website-insights']) {
        const sender = { ...ui, url: `chrome-extension://${id}/${page}${suffix}`, frameId: 0 };
        const result = await request<Snapshot>({ type: 'GET_SNAPSHOT' }, sender);
        expect(result.ok, `${page}${suffix} should remain an authorized UI page`).toBe(true);
      }
    }
    const sender = { ...ui, url: `chrome-extension://${id}/dashboard.html#website-insights`, frameId: 0 };
    expect((await request({ type: 'SET_THEME', theme: 'light' }, sender)).ok).toBe(true);
    expect(settings.theme).toBe('light');
  });

  it('does not trust lookalike URLs, another extension, unknown pages, or embedded frames', async () => {
    const senders: chrome.runtime.MessageSender[] = [
      { ...ui, id: 'foreign', url: `chrome-extension://${id}/dashboard.html#website-insights` },
      { ...ui, url: 'chrome-extension://other-extension/dashboard.html#website-insights' },
      { ...ui, url: `https://${id}/dashboard.html#website-insights` },
      { ...ui, url: `chrome-extension://${id}/unknown.html#dashboard.html` },
      { ...ui, url: `chrome-extension://${id}/nested/dashboard.html` },
      { ...ui, url: `chrome-extension://${id}/dashboard.html.attacker` },
      { ...ui, url: 'not a URL' },
      { ...ui, url: `chrome-extension://${id}/dashboard.html`, frameId: 1 },
    ];
    for (const sender of senders) {
      expect((await request({ type: 'GET_SNAPSHOT' }, sender)).ok).toBe(false);
      expect((await request({ type: 'SET_THEME', theme: 'light' }, sender)).ok).toBe(false);
    }
    expect(settings.theme).toBe('dark');
  });

  it('only stores sender-derived site/hour totals after explicit insights opt-in', async () => {
    await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, collector);
    expect(await state.db!.count('siteHours')).toBe(0);
    const old = checkpoint();
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    expect(settings.siteInsightsEnabled).toBe(true);
    expect(settings.siteInsightsSince).toBeTypeOf('number');
    expect(settings.epoch).not.toBe(old.epoch);
    const data = checkpoint({ hour: 10 });
    await request({ type: 'CHECKPOINT', checkpoint: data }, collector);
    await request({ type: 'CHECKPOINT', checkpoint: data }, collector);
    const detail = await state.db!.getAll('siteHours');
    expect(detail).toEqual([{ date: data.date, hour: 10, site: 'https://example.com', distancePx: 500, actions: 1, activeMs: 200 }]);
    expect((await state.db!.getAll('days'))[0]?.distancePx).toBe(1000);
    expect(JSON.stringify(detail)).not.toContain('private');
    expect(JSON.stringify(await state.db!.getAll('checkpoints'))).not.toContain('example.com');
  });

  it('rejects legacy daily collectors and spoofed site fields when insights are enabled', async () => {
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    expect((await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, collector)).ok).toBe(false);
    expect((await request({ type: 'CHECKPOINT', checkpoint: { ...checkpoint({ hour: 10 }), site: 'https://spoofed.example' } }, collector)).ok).toBe(false);
    expect(await state.db!.count('days')).toBe(0);
  });

  it('opt-out erases site details while keeping combined totals and rejecting in-flight old epochs', async () => {
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    const old = checkpoint({ hour: 10 });
    await request({ type: 'CHECKPOINT', checkpoint: old }, collector);
    await request({ type: 'SET_SITE_INSIGHTS', enabled: false });
    expect(settings.siteInsightsEnabled).toBe(false);
    expect(await state.db!.count('siteHours')).toBe(0);
    expect((await state.db!.getAll('days'))[0]?.distancePx).toBe(500);
    expect(await request({ type: 'CHECKPOINT', checkpoint: old }, collector)).toEqual({ ok: true, data: { accepted: false } });
    const result = await request<Snapshot>({ type: 'GET_SNAPSHOT' });
    expect(result.ok && result.data.siteHours).toEqual([]);
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    expect(await state.db!.count('siteHours')).toBe(0);
  });

  it('deletes one detailed site with epoch protection and leaves anonymous totals unchanged', async () => {
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    const old = checkpoint({ hour: 10 });
    await request({ type: 'CHECKPOINT', checkpoint: old }, collector);
    await request({ type: 'DELETE_SITE_INSIGHTS', site: 'https://example.com' });
    expect(await state.db!.count('siteHours')).toBe(0);
    expect((await state.db!.getAll('days'))[0]?.distancePx).toBe(500);
    expect(await request({ type: 'CHECKPOINT', checkpoint: old }, collector)).toEqual({ ok: true, data: { accepted: false } });
  });

  it('global deletion clears the new detail store and content scripts cannot change insights consent', async () => {
    expect((await request({ type: 'SET_SITE_INSIGHTS', enabled: true }, collector)).ok).toBe(false);
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    await request({ type: 'CHECKPOINT', checkpoint: checkpoint({ hour: 10 }) }, collector);
    await request({ type: 'CLEAR_DATA' });
    expect(await state.db!.count('days')).toBe(0);
    expect(await state.db!.count('siteHours')).toBe(0);
    expect(settings.trackingEnabled).toBe(false);
  });

  it('finishes interrupted per-site deletion from durable intent on the next snapshot', async () => {
    await request({ type: 'SET_SITE_INSIGHTS', enabled: true });
    await request({ type: 'CHECKPOINT', checkpoint: checkpoint({ hour: 10 }) }, collector);
    settings.pendingSiteDeletion = 'https://example.com';
    settings.epoch = crypto.randomUUID();
    const result = await request<Snapshot>({ type: 'GET_SNAPSHOT' });
    expect(result.ok && result.data.siteHours).toEqual([]);
    expect(settings.pendingSiteDeletion).toBeUndefined();
    expect((await state.db!.getAll('days'))[0]?.distancePx).toBe(500);
  });

  it('does not enable all sites without the actual optional grants', async () => {
    expect((await request({ type: 'SET_ALL_SITES', enabled: true })).ok).toBe(false);
    expect(settings.allSitesEnabled).toBe(false);
    expect(registrations[0]?.matches).toEqual(['https://example.com/*']);
  });

  it('registers broad matches only after opt-in and accepts another permitted host', async () => {
    granted.add('https://*/*'); granted.add('http://*/*');
    expect((await request({ type: 'SET_ALL_SITES', enabled: true })).ok).toBe(true);
    expect(registrations[0]?.matches).toEqual(['https://*/*', 'http://*/*']);
    const sender = { ...collector, url: 'https://www.youtube.com/watch?v=fixture' };
    expect((await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, sender)).ok).toBe(true);
    expect(await state.db!.count('days')).toBe(1);
  });

  it('excludes exact hosts from registration and aggregation, then can re-include them', async () => {
    granted.add('https://*/*'); granted.add('http://*/*');
    await request({ type: 'SET_ALL_SITES', enabled: true });
    const old = checkpoint();
    await request({ type: 'EXCLUDE_SITE', site: 'https://example.com/private?q=secret' });
    expect(settings.excludedSites).toEqual(['https://example.com']);
    expect(settings.epoch).not.toBe(old.epoch);
    expect(registrations[0]?.excludeMatches).toEqual(['https://example.com/*']);
    expect((await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, collector)).ok).toBe(false);
    expect(granted.has('https://*/*')).toBe(true);
    await request({ type: 'INCLUDE_SITE', site: 'https://example.com' });
    expect(registrations[0]?.excludeMatches).toEqual([]);
    expect((await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, collector)).ok).toBe(true);
  });

  it('revokes broad and covered host grants when all-site access is turned off', async () => {
    granted.add('https://*/*'); granted.add('http://*/*');
    await request({ type: 'SET_ALL_SITES', enabled: true });
    await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, collector);
    await request({ type: 'SET_ALL_SITES', enabled: false });
    expect(settings.allSitesEnabled).toBe(false);
    expect(settings.approvedSites).toEqual([]);
    expect(registrations).toEqual([]);
    expect(granted.size).toBe(0);
    expect(await state.db!.count('days')).toBe(1);
  });

  it('fails closed if a broad permission is partially revoked externally', async () => {
    granted.add('https://*/*'); granted.add('http://*/*');
    await request({ type: 'SET_ALL_SITES', enabled: true });
    granted.delete('http://*/*');
    onRemoved();
    await request({ type: 'GET_SNAPSHOT' });
    expect(settings.allSitesEnabled).toBe(false);
    expect(settings.approvedSites).toEqual([]);
    expect(registrations).toEqual([]);
    expect(granted.size).toBe(0);
  });

  it('preserves all-site choices through pause and deletion without collecting while paused', async () => {
    granted.add('https://*/*'); granted.add('http://*/*');
    await request({ type: 'SET_ALL_SITES', enabled: true });
    await request({ type: 'EXCLUDE_SITE', site: 'https://sensitive.example' });
    const old = checkpoint();
    await request({ type: 'CHECKPOINT', checkpoint: old }, collector);
    await request({ type: 'CLEAR_DATA' });
    expect(settings.allSitesEnabled).toBe(true);
    expect(settings.excludedSites).toEqual(['https://sensitive.example']);
    expect(settings.trackingEnabled).toBe(false);
    expect(registrations).toEqual([]);
    await request({ type: 'SET_TRACKING', enabled: true });
    expect(await request({ type: 'CHECKPOINT', checkpoint: old }, collector)).toEqual({ ok: true, data: { accepted: false } });
    expect(await state.db!.count('days')).toBe(0);
  });

  it('can retry a transient database opening failure without restarting Chrome', async () => {
    const data = checkpoint();
    await request({ type: 'CHECKPOINT', checkpoint: data }, collector);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.failOpen = true;
    vi.resetModules();
    const { default: main } = await import('../entrypoints/background');
    (main as unknown as () => void)();
    const unavailable = await request({ type: 'GET_SNAPSHOT' });
    expect(unavailable).toEqual({ ok: false, error: 'Local database could not be opened.' });
    expect(log).toHaveBeenCalled();
    state.failOpen = false;
    const recovered = await request<Snapshot>({ type: 'GET_SNAPSHOT' });
    expect(recovered.ok && recovered.data.days[0]?.distancePx).toBe(500);
  });

  it('registers only explicitly approved hosts', () => {
    expect(registrations[0]?.matches).toEqual(['https://example.com/*']);
    expect(registrations[0]?.persistAcrossSessions).toBe(true);
  });

  it('rejects content-script attempts to run UI commands', async () => {
    expect((await request({ type: 'CLEAR_DATA' }, collector)).ok).toBe(false);
    expect((await request({ type: 'ADD_SITE', site: 'https://other.com' }, collector)).ok).toBe(false);
  });

  it('rejects foreign senders, unapproved pages, subframes, and incognito', async () => {
    const data = checkpoint();
    for (const sender of [
      { ...collector, id: 'foreign' },
      { ...collector, url: 'https://unapproved.com' },
      { ...collector, frameId: 1 },
      { ...collector, tab: { id: 1, incognito: true } as chrome.tabs.Tab },
    ]) expect((await request({ type: 'CHECKPOINT', checkpoint: data }, sender)).ok).toBe(false);
    expect(await state.db!.count('days')).toBe(0);
  });

  it('rejects oversized or malformed measurements', async () => {
    for (const value of [null, {}, checkpoint({ distancePx: Infinity }), checkpoint({ activeMs: -1 })]) {
      expect((await request({ type: 'CHECKPOINT', checkpoint: value }, collector)).ok).toBe(false);
    }
  });

  it('requires an actual host grant before approving a site', async () => {
    expect((await request({ type: 'ADD_SITE', site: 'https://other.com' })).ok).toBe(false);
    expect(settings.approvedSites).toEqual(['https://example.com']);
    granted.add('https://other.com/*');
    expect((await request({ type: 'ADD_SITE', site: 'https://other.com/path?q=private' })).ok).toBe(true);
    expect(settings.approvedSites).toContain('https://other.com');
    expect(JSON.stringify(settings)).not.toContain('private');
  });

  it('persists no sender URLs or hostnames in historical records', async () => {
    const data = checkpoint();
    expect((await request({ type: 'CHECKPOINT', checkpoint: data }, collector)).ok).toBe(true);
    const history = JSON.stringify([await state.db!.getAll('days'), await state.db!.getAll('checkpoints')]);
    expect(history).not.toContain('example.com');
    expect(history).not.toContain('private');
    expect((await state.db!.get('days', data.date))?.distancePx).toBe(500);
  });

  it('rejects extra checkpoint fields rather than accidentally saving page metadata', async () => {
    const data = { ...checkpoint(), url: 'https://example.com/private?q=secret' };
    expect((await request({ type: 'CHECKPOINT', checkpoint: data }, collector)).ok).toBe(false);
    expect(await state.db!.count('days')).toBe(0);
    expect(await state.db!.count('checkpoints')).toBe(0);
  });

  it('makes replayed messages safe after aggregation', async () => {
    const data = checkpoint();
    await request({ type: 'CHECKPOINT', checkpoint: data }, collector);
    await request({ type: 'CHECKPOINT', checkpoint: data }, collector);
    const result = await request<Snapshot>({ type: 'GET_SNAPSHOT' });
    expect(result.ok && result.data.days[0]?.distancePx).toBe(500);
  });

  it('pauses collection and unregisters future injection without removing user choices', async () => {
    const data = checkpoint();
    await request({ type: 'SET_TRACKING', enabled: false });
    expect(registrations).toHaveLength(0);
    expect(settings.approvedSites).toEqual(['https://example.com']);
    expect((await request({ type: 'CHECKPOINT', checkpoint: data }, collector)).ok).toBe(false);
  });

  it('rejects old-epoch data even after tracking is resumed', async () => {
    const old = checkpoint();
    await request({ type: 'CHECKPOINT', checkpoint: old }, collector);
    await request({ type: 'CLEAR_DATA' });
    await request({ type: 'SET_TRACKING', enabled: true });
    const replay = await request<{ accepted: boolean }>({ type: 'CHECKPOINT', checkpoint: old }, collector);
    expect(replay).toEqual({ ok: true, data: { accepted: false } });
    expect(await state.db!.count('days')).toBe(0);
    expect(await state.db!.count('checkpoints')).toBe(0);
  });

  it('blocks checkpoints immediately if Chrome host permission was revoked', async () => {
    granted.clear();
    const result = await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, collector);
    expect(result).toEqual({ ok: true, data: { accepted: false } });
    expect(await state.db!.count('days')).toBe(0);
  });

  it('reconciles permissions revoked outside the extension', async () => {
    granted.clear();
    onRemoved();
    await request({ type: 'GET_SNAPSHOT' });
    expect(settings.approvedSites).toEqual([]);
    expect(registrations).toEqual([]);
  });

  it('removes a site and revokes its permission without deleting unrelated history', async () => {
    await request({ type: 'CHECKPOINT', checkpoint: checkpoint() }, collector);
    await request({ type: 'REMOVE_SITE', site: 'https://example.com' });
    expect(granted.size).toBe(0);
    expect(settings.approvedSites).toEqual([]);
    expect(registrations).toEqual([]);
    expect(await state.db!.count('days')).toBe(1);
  });
});