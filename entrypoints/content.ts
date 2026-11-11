import { defineContentScript } from 'wxt/utils/define-content-script';
import { v4 as uuid } from 'uuid';
import { daysAgo, localDate, RETENTION_DAYS } from '../src/analytics/metrics';
import { ScrollTracker } from '../src/tracking/ScrollTracker';
import { HourlyScrollTracker } from '../src/tracking/HourlyScrollTracker';
import { canTrackUrl } from '../src/utils/sites';
import type { Checkpoint, Response, Settings } from '../src/types';

export default defineContentScript({
  // Runtime registrations supply matches AFTER permission is granted. Nonempty
  // matches here would make WXT add mandatory host_permissions to the manifest.
  matches: [],
  registration: 'runtime',
  noScriptStartedPostMessage: true,
  main(ctx) {
    const scope = globalThis as typeof globalThis & { __scrollMilesStarted?: boolean };
    if (scope.__scrollMilesStarted) return;
    scope.__scrollMilesStarted = true;

    let settings: Settings | undefined;
    let positions = new WeakMap<Element, number>();
    let sequence = 0;
    let pending = false;
    let sending = false;
    let dirty = false;
    let retryCount = 0;
    const trackers = new Map<string, {
      date: string; hour?: number; tracker: ScrollTracker; streamId: string; version: number;
    }>();
    const dirtyKeys = new Set<string>();
    const hourly = new HourlyScrollTracker();

    const position = (element: Element) => Math.max(0, Math.min(element.scrollTop, Math.max(0, element.scrollHeight - element.clientHeight)));
    const root = () => document.scrollingElement;
    const allowed = () => !!settings?.trackingEnabled && canTrackUrl(location.href, settings)
      && document.visibilityState === 'visible' && document.hasFocus();

    function resetPositions(): void {
      positions = new WeakMap();
      const element = root();
      if (element) positions.set(element, position(element));
      for (const { tracker } of trackers.values()) tracker.breakBurst();
      hourly.breakBurst();
    }

    function updateSettings(next: Settings): void {
      if (next.epoch !== settings?.epoch) {
        trackers.clear();
        dirtyKeys.clear();
        sequence = 0;
        dirty = false;
        resetPositions();
      }
      settings = next;
    }

    async function flush(): Promise<void> {
      if (sending || !dirty || !settings || ctx.isInvalid) return;
      sending = true;
      dirty = false;
      const epoch = settings.epoch;
      const currentSequence = ++sequence;
      const currentDate = localDate();
      const cutoff = daysAgo(RETENTION_DAYS - 1);
      // Snapshot before awaiting. A policy update or date change cannot mutate
      // an in-flight batch. Each retained day has its own stable stream ID.
      const batch = [...dirtyKeys].flatMap((key) => {
        const state = trackers.get(key);
        if (!state || state.date < cutoff || state.date > currentDate) return [];
        const { date, hour, tracker, streamId, version } = state;
        const checkpoint: Checkpoint = {
          date, epoch, streamId, sequence: currentSequence,
          ...(hour === undefined ? {} : { hour }),
          distancePx: tracker.distancePx, actions: tracker.actions, activeMs: tracker.activeMs,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, recordedAt: Date.now(),
        };
        return [{ key, version, checkpoint }];
      });
      try {
        for (const { key, version, checkpoint } of batch) {
          const response = await chrome.runtime.sendMessage({ type: 'CHECKPOINT', checkpoint }) as Response<{ accepted: boolean }>;
          if (settings.epoch !== epoch) break;
          if (!response.ok) throw new Error(response.error);
          if (!response.data.accepted) {
            const latest = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) as Response<Settings>;
            if (latest.ok) updateSettings(latest.data);
            break;
          }
          if (trackers.get(key)?.version === version) dirtyKeys.delete(key);
        }
        retryCount = 0;
      } catch {
        if (ctx.isValid && settings.epoch === epoch) {
          dirty = true;
          // Bounded retries. A later scroll can try again without an unbounded queue.
          if (++retryCount <= 3) schedule(1_000 * 2 ** retryCount);
        }
      } finally {
        sending = false;
        if (dirty && retryCount === 0) schedule();
      }
    }

    function schedule(delay = 1_000): void {
      if (pending || ctx.isInvalid) return;
      pending = true;
      ctx.setTimeout(() => { pending = false; void flush(); }, delay);
    }

    function onScroll(event: Event): void {
      const element = event.target === document ? root() : event.target;
      if (!(element instanceof Element)) return;
      const current = position(element);
      const previous = positions.get(element);
      positions.set(element, current);
      if (!allowed() || previous === undefined || current === previous) return;
      const date = localDate();
      const cutoff = daysAgo(RETENTION_DAYS - 1);
      for (const [key, state] of trackers) {
        if (state.date < cutoff) { trackers.delete(key); dirtyKeys.delete(key); }
      }
      const now = performance.now();
      const changes = settings?.siteInsightsEnabled
        ? hourly.record(current - previous, now, Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone)
        : [{ date, hour: undefined }];
      for (const change of changes) {
        const key = `${change.date}:${change.hour ?? 'day'}`;
        let state = trackers.get(key);
        if (!state) {
          // 90 calendar days × 24 hours, no unbounded per-event queue.
          if (trackers.size >= RETENTION_DAYS * 24) continue;
          state = { date: change.date, hour: change.hour, tracker: new ScrollTracker(), streamId: uuid(), version: 0 };
          trackers.set(key, state);
        }
        if ('distancePx' in change) {
          state.tracker.distancePx += change.distancePx;
          state.tracker.actions += change.actions;
          state.tracker.activeMs += change.activeMs;
        } else state.tracker.record(current - previous, now);
        state.version += 1;
        dirtyKeys.add(key);
      }
      dirty = true;
      schedule();
    }

    // Prime nested scroll containers before their first movement. Read geometry only.
    function seedAncestors(event: Event): void {
      if (!allowed()) return;
      for (const target of event.composedPath()) {
        if (target instanceof Element && !positions.has(target)) positions.set(target, position(target));
      }
    }

    ctx.addEventListener(document, 'scroll', onScroll, { capture: true, passive: true });
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'pointerover'] as const) {
      ctx.addEventListener(document, type, seedAncestors, { capture: true, passive: true });
    }
    ctx.addEventListener(document, 'visibilitychange', () => { void flush(); resetPositions(); });
    ctx.addEventListener(window, 'blur', () => { void flush(); resetPositions(); });
    ctx.addEventListener(window, 'focus', resetPositions);
    ctx.addEventListener(window, 'pagehide', () => { void flush(); });
    ctx.addEventListener(window, 'pageshow', resetPositions);

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.settings?.newValue) updateSettings(changes.settings.newValue as Settings);
    };
    chrome.storage.onChanged.addListener(onChanged);
    ctx.onInvalidated(() => {
      chrome.storage.onChanged.removeListener(onChanged);
      delete scope.__scrollMilesStarted;
    });
    resetPositions();
    void chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).then((response: Response<Settings>) => {
      if (response.ok) updateSettings(response.data);
    }).catch(() => undefined);
  },
});