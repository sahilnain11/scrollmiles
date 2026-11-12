import { describe, expect, it } from 'vitest';
import { compareCompleteWeeks, hourlyPattern, metricChange, scrollingSummary } from '../src/analytics/insights';
import { daysAgo, localDate } from '../src/analytics/metrics';
import type { DayStats, SiteHourStats } from '../src/types';

const now = new Date(2026, 10, 12, 12);
const row = (date: string, distancePx = 100): DayStats => ({ date, distancePx, actions: 2, activeMs: 200 });
const complete = () => Array.from({ length: 14 }, (_, index) => row(daysAgo(index + 1, now), index < 7 ? 200 : 100));
const hour = (date: string, value: number, at: number, site = 'https://private.example'): SiteHourStats => ({ ...row(date, value), site, hour: at });

describe('deterministic scrolling insights', () => {
  it('uses only dates in the selected daily/seven-day window, without mutating input', () => {
    const records = [row(localDate(now), 500), row(daysAgo(6, now), 200), row(daysAgo(7, now), 900), row(daysAgo(-1, now), 2000)];
    const before = structuredClone(records);
    expect(scrollingSummary(records, 'today', now).totals.distancePx).toBe(500);
    expect(scrollingSummary(records, 'week', now).totals.distancePx).toBe(700);
    expect(records).toEqual(before);
  });
  it('does not infer a peak from empty or zero data', () => {
    const result = scrollingSummary([], 'week', now);
    expect(result.recordedDays).toBe(0);
    expect(result.peakDays).toEqual([]);
    expect(result.totals.distancePx).toBe(0);
  });
  it('reports all tied dates in chronological order rather than inventing a winner', () => {
    const result = scrollingSummary([row(localDate(now)), row(daysAgo(2, now))], 'week', now);
    expect(result.peakDays.map(({ date }) => date)).toEqual([daysAgo(2, now), localDate(now)]);
  });
  it('compares completed equal periods, excluding today and out-of-range data', () => {
    const result = compareCompleteWeeks([...complete(), row(localDate(now), 1e6), row(daysAgo(15, now), 1e6)], now);
    expect(result.state).toBe('ready');
    expect(result.current).toMatchObject({ start: '2026-11-05', end: '2026-11-11', recordedDays: 7 });
    expect(result.previous).toMatchObject({ start: '2026-10-29', end: '2026-11-04', recordedDays: 7 });
    expect(result.changes?.distancePx).toEqual({ absolute: 700, percent: 100 });
    expect(result.changes?.actions).toEqual({ absolute: 0, percent: 0 });
  });
  it('keeps absent rows unknown and suppresses changes until all dates have aggregates', () => {
    const result = compareCompleteWeeks(complete().slice(1), now);
    expect(result.state).toBe('insufficient');
    expect(result.current.recordedDays).toBe(6);
    expect(result.changes).toBeNull();
    expect(compareCompleteWeeks(undefined, now).state).toBe('unavailable');
    expect(compareCompleteWeeks([], now).state).toBe('insufficient');
  });
  it('does not divide by zero or label missing baselines as growth', () => {
    expect(metricChange(100, 0)).toEqual({ absolute: 100, percent: null });
    expect(metricChange(0, 0)).toEqual({ absolute: 0, percent: null });
    expect(metricChange(50, 100)).toEqual({ absolute: -50, percent: -50 });
    const records = complete().map((value, index) => index >= 7 ? { ...value, distancePx: 0 } : value);
    expect(compareCompleteWeeks(records, now).changes?.distancePx.percent).toBeNull();
  });
  it('uses calendar arithmetic across month/year and leap-day boundaries', () => {
    const january = compareCompleteWeeks([], new Date(2027, 0, 1, 12));
    expect(january.current).toMatchObject({ start: '2026-12-25', end: '2026-12-31' });
    expect(january.previous).toMatchObject({ start: '2026-12-18', end: '2026-12-24' });
    expect(compareCompleteWeeks([], new Date(2028, 2, 1, 12)).current.end).toBe('2028-02-29');
  });
  it('explicitly projects anonymous models rather than retaining source metadata or references', () => {
    const records = complete().map((value) => ({ ...value, site: 'https://private.example', fullUrl: 'https://private.example/secret' }));
    const summary = scrollingSummary(records, 'week', now);
    const comparison = compareCompleteWeeks(records, now);
    records[0]!.distancePx = 99999;
    expect(summary.peakDays[0]?.distancePx).toBe(200);
    expect(comparison.current.totals.distancePx).toBe(1400);
    expect(JSON.stringify([summary, comparison])).not.toMatch(/private|secret|fullUrl|site/);
  });
});

describe('opted-in hour view models', () => {
  it('builds exactly 168 cells, aggregates multiple exact sites, and drops out-of-range rows', () => {
    const rows = [hour(localDate(now), 100, 10), hour(localDate(now), 200, 10, 'http://www.other.example'), hour(daysAgo(6, now), 40, 4), hour(daysAgo(7, now), 9999, 10), hour(daysAgo(-1, now), 9999, 10)];
    const result = hourlyPattern(rows, 'week', now);
    expect(result.cells).toHaveLength(168);
    expect(result.peakHours).toEqual([{ date: 'period', hour: 10, distancePx: 300, actions: 4, activeMs: 400 }]);
    expect(result.cells[6 * 24 + 10]).toMatchObject({ hasRecord: true, distancePx: 300 });
    expect(result.cells[0]).toMatchObject({ hasRecord: false, distancePx: 0 });
    expect(JSON.stringify(result)).not.toMatch(/example|https|site/);
  });
  it('keeps the heatmap seven-day while the peak respects Today and handles all ties', () => {
    const rows = [hour(daysAgo(1, now), 500, 5), hour(localDate(now), 100, 10), hour(localDate(now), 100, 11)];
    expect(hourlyPattern(rows, 'today', now).peakHours.map(({ hour }) => hour)).toEqual([10, 11]);
    expect(hourlyPattern(rows, 'week', now).peakHours.map(({ hour }) => hour)).toEqual([5]);
    expect(hourlyPattern(rows, 'today', now).cells[5 * 24 + 5]?.distancePx).toBe(500);
  });
  it('preserves zero/subsecond counters, ignores invalid hours, and does not infer a zero peak', () => {
    const rows = [{ ...hour(localDate(now), 1, 23), actions: 0, activeMs: 200 }, hour(localDate(now), 999, 24), hour(localDate(now), 999, -1), hour(localDate(now), 999, 1.5)];
    expect(hourlyPattern(rows, 'today', now).peakHours[0]).toMatchObject({ hour: 23, activeMs: 200, actions: 0 });
    expect(hourlyPattern([], 'week', now).peakHours).toEqual([]);
  });
  it('merges repeated local hours as already stored, without inventing timestamps or relocating rows', () => {
    const result = hourlyPattern([hour('2026-11-01', 50, 1), hour('2026-11-01', 75, 1)], 'week', new Date(2026, 10, 2, 12));
    expect(result.cells.find((cell) => cell.date === '2026-11-01' && cell.hour === 1)?.distancePx).toBe(125);
    expect(result.dates).toHaveLength(7);
  });
});