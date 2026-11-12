import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { daysAgo, localDate } from '../src/analytics/metrics';
import { applyCheckpoint, clearHistory, getComparisonDays, getRetainedHistory, openStatsDatabase, pruneHistory, type StatsConnection } from '../src/storage/database';
import type { Checkpoint } from '../src/types';

let db: StatsConnection;
const checkpoint = (overrides: Partial<Checkpoint> = {}): Checkpoint => ({
  epoch: crypto.randomUUID(), streamId: crypto.randomUUID(), sequence: 1,
  date: localDate(), timezone: 'UTC', recordedAt: Date.now(),
  distancePx: 1_000, actions: 1, activeMs: 100, ...overrides,
});

beforeEach(async () => { db = await openStatsDatabase(`test-${crypto.randomUUID()}`); });
afterEach(() => db.close());

describe('atomic checkpoint storage', () => {
  it('reads at most the existing 90-day anonymous window with date bounds and no inferred rows', async () => {
    const now = new Date(2026, 10, 12, 12);
    for (let index = -1; index <= 91; index++) {
      const fixture = { date: daysAgo(index, now), distancePx: 100, actions: 1, activeMs: 0, site: 'https://private.example' };
      await db.put('days', fixture);
    }
    const result = await getRetainedHistory(db, now);
    expect(result.startDate).toBe(daysAgo(89, now));
    expect(result.endDate).toBe(localDate(now));
    expect(result.days).toHaveLength(90);
    expect(result.days[0]?.date).toBe(daysAgo(89, now));
    expect(result.days.at(-1)?.date).toBe(localDate(now));
    expect(JSON.stringify(result)).not.toContain('private');
    expect(db.version).toBe(2);
    expect(await db.count('days')).toBe(93);
    await clearHistory(db);
    expect((await getRetainedHistory(db, now)).days).toEqual([]);
  });
  it('reads only 14 complete anonymous days without changing retention or writing missing zeros', async () => {
    const now = new Date(2026, 10, 12, 12);
    for (let index = -1; index <= 16; index++) await db.put('days', { date: daysAgo(index, now), distancePx: 100, actions: 1, activeMs: 0 });
    const records = await getComparisonDays(db, now);
    expect(records).toHaveLength(14);
    expect(records[0]?.date).toBe('2026-10-29');
    expect(records.at(-1)?.date).toBe('2026-11-11');
    expect(Object.keys(records[0]!).sort()).toEqual(['actions', 'activeMs', 'date', 'distancePx']);
    expect(await db.count('days')).toBe(18);
    expect(db.version).toBe(2);
  });
  it('applies a retry only once', async () => {
    const data = checkpoint();
    await applyCheckpoint(db, data);
    await applyCheckpoint(db, data);
    expect((await db.get('days', data.date))?.distancePx).toBe(1_000);
  });
  it('applies only the difference and ignores out-of-order messages', async () => {
    const data = checkpoint();
    await applyCheckpoint(db, data);
    await applyCheckpoint(db, { ...data, sequence: 3, distancePx: 1_500, actions: 2 });
    await applyCheckpoint(db, { ...data, sequence: 2, distancePx: 1_200 });
    expect(await db.get('days', data.date)).toEqual({ date: data.date, distancePx: 1_500, actions: 2, activeMs: 100 });
  });
  it('combines multiple documents without lost updates', async () => {
    const data = checkpoint();
    await Promise.all([applyCheckpoint(db, data), applyCheckpoint(db, checkpoint())]);
    expect((await db.get('days', data.date))?.distancePx).toBe(2_000);
  });
  it('keeps deduplication state after reopening the database', async () => {
    const name = db.name;
    const data = checkpoint();
    await applyCheckpoint(db, data);
    db.close();
    db = await openStatsDatabase(name);
    await applyCheckpoint(db, data);
    expect((await db.get('days', data.date))?.distancePx).toBe(1_000);
  });
  it('rejects counters moving backwards atomically', async () => {
    const data = checkpoint();
    await applyCheckpoint(db, data);
    await expect(applyCheckpoint(db, { ...data, sequence: 2, distancePx: 500 })).rejects.toThrow('backwards');
    expect((await db.get('days', data.date))?.distancePx).toBe(1_000);
  });
  it('prunes old totals and deduplication records together', async () => {
    await applyCheckpoint(db, checkpoint({ date: daysAgo(90) }));
    await applyCheckpoint(db, checkpoint({ date: daysAgo(89) }));
    await pruneHistory(db);
    expect(await db.count('days')).toBe(1);
    expect(await db.count('checkpoints')).toBe(1);
  });
  it('clears totals and checkpoints together', async () => {
    await applyCheckpoint(db, checkpoint());
    await clearHistory(db);
    expect(await db.count('days')).toBe(0);
    expect(await db.count('checkpoints')).toBe(0);
  });
});