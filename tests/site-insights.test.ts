import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { daysAgo, localDate } from '../src/analytics/metrics';
import { siteDays, siteHoursForPeriod, siteSummaries } from '../src/analytics/sites';
import { applyCheckpoint, clearHistory, clearSiteHistory, openStatsDatabase, pruneHistory, type StatsConnection } from '../src/storage/database';
import { HourlyScrollTracker } from '../src/tracking/HourlyScrollTracker';
import { isCheckpoint } from '../src/utils/validation';
import type { Checkpoint, SiteHourStats } from '../src/types';

const checkpoint = (overrides: Partial<Checkpoint> = {}): Checkpoint => ({
  date: localDate(), hour: 10, distancePx: 500, actions: 1, activeMs: 200,
  epoch: crypto.randomUUID(), streamId: crypto.randomUUID(), sequence: 1,
  timezone: 'UTC', recordedAt: Date.now(), ...overrides,
});

describe('hourly measurement', () => {
  it('counts a continuous burst once and splits its duration at an hour boundary', () => {
    const tracker = new HourlyScrollTracker();
    const start = new Date(2026, 10, 11, 10, 59, 59, 500).getTime();
    const first = tracker.record(500, 100, start, 'UTC');
    const next = tracker.record(-200, 1100, start + 1000, 'UTC');
    expect(first).toEqual([{ date: '2026-11-11', hour: 10, distancePx: 500, actions: 1, activeMs: 0 }]);
    expect(next).toEqual([
      { date: '2026-11-11', hour: 10, distancePx: 0, actions: 0, activeMs: 500 },
      { date: '2026-11-11', hour: 11, distancePx: 200, actions: 0, activeMs: 500 },
    ]);
  });
  it('splits a continuous gap across midnight without inventing another burst', () => {
    const tracker = new HourlyScrollTracker();
    const start = new Date(2026, 10, 11, 23, 59, 59, 800).getTime();
    tracker.record(100, 100, start, 'UTC');
    expect(tracker.record(100, 500, start + 400, 'UTC')).toEqual([
      { date: '2026-11-11', hour: 23, distancePx: 0, actions: 0, activeMs: 200 },
      { date: '2026-11-12', hour: 0, distancePx: 100, actions: 0, activeMs: 200 },
    ]);
  });
  it('breaks on idle, focus loss, wall-clock discontinuity, and timezone changes', () => {
    const tracker = new HourlyScrollTracker();
    const start = new Date(2026, 10, 11, 10).getTime();
    tracker.record(100, 0, start, 'UTC');
    expect(tracker.record(100, 2000, start + 2000, 'UTC')[0]?.actions).toBe(1);
    tracker.breakBurst();
    expect(tracker.record(100, 2100, start + 2100, 'UTC')[0]?.activeMs).toBe(0);
    expect(tracker.record(100, 2200, start - 60_000, 'UTC')[0]?.actions).toBe(1);
    expect(tracker.record(100, 2300, start - 59_900, 'Asia/Kolkata')[0]?.actions).toBe(1);
  });
  it('rejects invalid movement and backwards monotonic clocks', () => {
    const tracker = new HourlyScrollTracker();
    expect(tracker.record(NaN, 0, Date.now(), 'UTC')).toEqual([]);
    tracker.record(10, 10, Date.now(), 'UTC');
    expect(tracker.record(10, 9, Date.now(), 'UTC')).toEqual([]);
  });
  it('validates hour bounds and never accepts a caller-provided hostname', () => {
    expect(isCheckpoint(checkpoint())).toBe(true);
    for (const hour of [-1, 24, 1.5, Infinity]) expect(isCheckpoint(checkpoint({ hour }))).toBe(false);
    expect(isCheckpoint({ ...checkpoint(), site: 'https://spoofed.example' })).toBe(false);
  });
});

describe('atomic opt-in site storage', () => {
  let db: StatsConnection;
  beforeEach(async () => { db = await openStatsDatabase(`insights-${crypto.randomUUID()}`); });
  afterEach(() => db.close());

  it('migrates version one without assigning old anonymous history to a website', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    const original = await openDB(name, 1, { upgrade(database) {
      database.createObjectStore('days', { keyPath: 'date' });
      database.createObjectStore('checkpoints').createIndex('date', 'date');
    } });
    await original.put('days', { date: localDate(), distancePx: 1500, actions: 3, activeMs: 200 });
    original.close();
    const migrated = await openStatsDatabase(name);
    expect((await migrated.get('days', localDate()))?.distancePx).toBe(1500);
    expect(await migrated.count('siteHours')).toBe(0);
    expect(migrated.version).toBe(2);
    migrated.close();
  });
  it('updates detailed/global totals and checkpoints once, even on retries and concurrent tabs', async () => {
    const data = checkpoint();
    await Promise.all([applyCheckpoint(db, data, 'https://example.com'), applyCheckpoint(db, data, 'https://example.com')]);
    await applyCheckpoint(db, { ...data, sequence: 2, distancePx: 800, activeMs: 300 }, 'https://example.com');
    await applyCheckpoint(db, checkpoint({ distancePx: 200 }), 'https://example.com');
    expect((await db.get('days', data.date))?.distancePx).toBe(1000);
    expect((await db.get('siteHours', ['https://example.com', data.date, 10]))?.distancePx).toBe(1000);
    expect(await db.count('checkpoints')).toBe(2);
  });
  it('stores no site detail when the worker does not provide an opted-in site', async () => {
    await applyCheckpoint(db, checkpoint());
    expect(await db.count('siteHours')).toBe(0);
    expect(JSON.stringify(await db.getAll('checkpoints'))).not.toContain('example.com');
  });
  it('rejects backwards counters without partially updating detail or global totals', async () => {
    const data = checkpoint();
    await applyCheckpoint(db, data, 'https://example.com');
    await expect(applyCheckpoint(db, { ...data, sequence: 2, distancePx: 1 }, 'https://example.com')).rejects.toThrow('backwards');
    expect((await db.getAll('days'))[0]?.distancePx).toBe(500);
    expect((await db.getAll('siteHours'))[0]?.distancePx).toBe(500);
  });
  it('rejects legacy daily checkpoints for opted-in detailed aggregation', async () => {
    await expect(applyCheckpoint(db, checkpoint({ hour: undefined }), 'https://example.com')).rejects.toThrow('Hourly collector');
    expect(await db.count('days')).toBe(0);
  });
  it('deletes one site without changing anonymous totals, another site, or dedup state', async () => {
    const data = checkpoint();
    await applyCheckpoint(db, data, 'https://example.com');
    await applyCheckpoint(db, checkpoint(), 'https://other.example');
    await clearSiteHistory(db, 'https://example.com');
    await applyCheckpoint(db, data, 'https://example.com');
    expect((await db.getAll('days'))[0]?.distancePx).toBe(1000);
    expect((await db.getAll('siteHours')).map(({ site }) => site)).toEqual(['https://other.example']);
    expect(await db.count('checkpoints')).toBe(2);
  });
  it('clears all detailed history on opt-out without removing combined totals', async () => {
    await applyCheckpoint(db, checkpoint(), 'https://example.com');
    await clearSiteHistory(db);
    expect(await db.count('siteHours')).toBe(0);
    expect(await db.count('days')).toBe(1);
    await clearHistory(db);
    expect(await db.count('days')).toBe(0);
    expect(await db.count('siteHours')).toBe(0);
    expect(await db.count('checkpoints')).toBe(0);
  });
  it('prunes site rows on the same calendar retention boundary', async () => {
    await applyCheckpoint(db, checkpoint({ date: daysAgo(90) }), 'https://example.com');
    await applyCheckpoint(db, checkpoint({ date: daysAgo(89) }), 'https://example.com');
    await pruneHistory(db);
    expect(await db.count('siteHours')).toBe(1);
    expect(await db.count('days')).toBe(1);
  });
});

describe('honest site reporting', () => {
  const rows: SiteHourStats[] = [
    { site: 'https://a.example', date: '2026-11-11', hour: 10, distancePx: 500, actions: 1, activeMs: 100 },
    { site: 'https://a.example', date: '2026-11-10', hour: 10, distancePx: 200, actions: 1, activeMs: 50 },
    { site: 'https://b.example', date: '2026-11-11', hour: 11, distancePx: 800, actions: 2, activeMs: 200 },
  ];
  it('ranks sites by the selected period, not their permission list', () => {
    expect(siteSummaries(rows, 'today', '2026-11-11').map(({ site, distancePx }) => [site, distancePx])).toEqual([
      ['https://b.example', 800], ['https://a.example', 500],
    ]);
    expect(siteSummaries(rows, 'week')[1]?.distancePx).toBe(700);
  });
  it('fills only missing values with zero and combines matching hours across days', () => {
    const hours = siteHoursForPeriod(rows, 'https://a.example', 'week', '2026-11-11');
    expect(hours).toHaveLength(24);
    expect(hours[10]?.distancePx).toBe(700);
    expect(hours[9]?.distancePx).toBe(0);
    const days = siteDays(rows, 'https://a.example', new Date(2026, 10, 11));
    expect(days).toHaveLength(7);
    expect(days[0]?.distancePx).toBe(0);
    expect(days[6]?.distancePx).toBe(500);
  });
});