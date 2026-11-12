import { describe, expect, it } from 'vitest';
import { monthlySummary, retainedMonths, retainedRecords } from '../src/analytics/history';
import { daysAgo, localDate } from '../src/analytics/metrics';
import type { DayStats, RetainedHistory } from '../src/types';

const now = new Date(2026, 10, 12, 12);
const row = (date: string, distancePx = 100, actions = 1, activeMs = 200): DayStats => ({ date, distancePx, actions, activeMs });
const history = (days: DayStats[] = [], anchor = now): RetainedHistory => ({ startDate: daysAgo(89, anchor), endDate: localDate(anchor), days });

describe('retained daily records', () => {
  it('uses past dates only, with all ties in chronological order and separate metric maxima', () => {
    const result = retainedRecords(history([row('2026-11-11', 400, 2, 200), row('2026-10-10', 400, 3, 500), row('2026-11-12', 9999, 99, 9999)]));
    expect(result.distancePx).toEqual({ value: 400, dates: ['2026-10-10', '2026-11-11'] });
    expect(result.actions).toEqual({ value: 3, dates: ['2026-10-10'] });
    expect(result.activeMs).toEqual({ value: 500, dates: ['2026-10-10'] });
    expect(result.totals.distancePx).toBe(10799);
    expect(result.pastSavedDays).toBe(2);
    expect(result.endDate).toBe('2026-11-11');
  });
  it('ignores expired and future rows even if supplied, retaining the boundary date', () => {
    const data = history();
    data.days = [row(data.startDate, 500), row(daysAgo(90, now), 9999), row(daysAgo(-1, now), 9999)];
    expect(retainedRecords(data).distancePx).toEqual({ value: 500, dates: [data.startDate] });
    expect(retainedRecords(data).savedDays).toBe(1);
  });
  it('does not invent a record for zero, empty or today-only data', () => {
    for (const days of [[], [row('2026-11-11', 0, 0, 0)], [row('2026-11-12')]]) {
      const result = retainedRecords(history(days));
      expect(result.distancePx.dates).toEqual([]);
      expect(result.actions.dates).toEqual([]);
      expect(result.activeMs.dates).toEqual([]);
    }
  });
  it('recomputes after expiry or deletion, without a permanent lifetime record', () => {
    const data = history([row(daysAgo(89, now), 500), row(daysAgo(1, now), 100)]);
    expect(retainedRecords(data).distancePx.value).toBe(500);
    const tomorrow = new Date(2026, 10, 13, 12);
    expect(retainedRecords(history(data.days, tomorrow)).distancePx.value).toBe(100);
    expect(retainedRecords(history([])).savedDays).toBe(0);
  });
});

describe('calendar-month summaries', () => {
  it('offers every intersecting month, including a clipped oldest month, newest first', () => {
    expect(retainedMonths(history())).toEqual(['2026-11', '2026-10', '2026-09', '2026-08']);
    expect(retainedMonths(history([], new Date(2027, 0, 1, 12)))).toEqual(['2027-01', '2026-12', '2026-11', '2026-10']);
  });
  it('includes partial today in the labeled month subtotal but never includes future dates', () => {
    const result = monthlySummary(history([row('2026-11-11', 100), row('2026-11-12', 200), row('2026-11-13', 9999), row('2026-10-31', 9999)]), '2026-11');
    expect(result.totals.distancePx).toBe(300);
    expect(result.includesToday).toBe(true);
    expect(result.endDate).toBe('2026-11-12');
    expect(result.eligibleDays).toBe(12);
    expect(result.days[12]).toEqual({ date: '2026-11-13', state: 'future', stats: null });
  });
  it('distinguishes a saved zero from an unknown missing record', () => {
    const result = monthlySummary(history([row('2026-11-01', 0, 0, 0)]), '2026-11');
    expect(result.days[0]).toMatchObject({ state: 'recorded', stats: { distancePx: 0 } });
    expect(result.days[1]).toEqual({ date: '2026-11-02', state: 'no-record', stats: null });
    expect(result.savedDays).toBe(1);
  });
  it('clips an older month at retention without filling earlier dates with zeros', () => {
    const data = history();
    data.days = [row('2026-08-01', 9999), row(data.startDate, 50), row('2026-08-31', 100)];
    const result = monthlySummary(data, '2026-08');
    expect(result.clippedStart).toBe(true);
    expect(result.startDate).toBe(data.startDate);
    expect(result.endDate).toBe('2026-08-31');
    expect(result.days[0]).toEqual({ date: '2026-08-01', state: 'outside-retention', stats: null });
    expect(result.totals.distancePx).toBe(150);
  });
  it('handles leap February, short months, year boundaries and first-of-month anchors', () => {
    const leap = monthlySummary(history([], new Date(2028, 2, 1, 12)), '2028-02');
    expect(leap.days).toHaveLength(29);
    expect(leap.endDate).toBe('2028-02-29');
    expect(leap.includesToday).toBe(false);
    expect(monthlySummary(history([], new Date(2027, 2, 1, 12)), '2027-02').days).toHaveLength(28);
    const january = monthlySummary(history([], new Date(2027, 0, 1, 12)), '2027-01');
    expect(january.eligibleDays).toBe(1);
    expect(january.days[1]?.state).toBe('future');
    expect(monthlySummary(history([], new Date(2027, 0, 1, 12)), '2026-12').days).toHaveLength(31);
  });
  it('rejects invalid/unavailable months instead of defaulting to fake empty data', () => {
    for (const month of ['2026-07', '2026-12', '2026-13', 'not-a-month']) {
      expect(() => monthlySummary(history(), month)).toThrow('outside');
    }
  });
  it('returns site-free numeric copies and never mutates or retains storage object references', () => {
    const days = [{ ...row('2026-11-11'), site: 'https://private.example', fullUrl: 'https://private.example/secret' }];
    const data = history(days);
    const monthly = monthlySummary(data, '2026-11');
    const records = retainedRecords(data);
    days[0]!.distancePx = 9999;
    expect(monthly.days[10]?.stats?.distancePx).toBe(100);
    expect(records.distancePx.value).toBe(100);
    expect(JSON.stringify([monthly, records])).not.toMatch(/private|secret|site|fullUrl/);
  });
});