import { daysAgo, emptyDay, lastSevenDays, localDate, sumDays } from './metrics';
import type { DayStats, SiteHourStats } from '../types';

export type InsightPeriod = 'today' | 'week';
export type InsightMetric = 'distancePx' | 'actions' | 'activeMs';

function anonymous(row: DayStats): DayStats {
  return { date: row.date, distancePx: row.distancePx, actions: row.actions, activeMs: row.activeMs };
}

export function scrollingSummary(records: DayStats[], period: InsightPeriod, now = new Date()) {
  const week = lastSevenDays(records, now).map(anonymous);
  const days = period === 'today' ? week.slice(-1) : week;
  const maximum = Math.max(0, ...days.map((day) => day.distancePx));
  return {
    start: period === 'today' ? localDate(now) : daysAgo(6, now), end: localDate(now),
    totals: sumDays(days),
    recordedDays: days.filter((day) => day.distancePx > 0).length,
    peakDays: maximum > 0 ? days.filter((day) => day.distancePx === maximum) : [],
  };
}

function completePeriod(records: DayStats[], startAgo: number, now: Date) {
  const map = new Map(records.map((row) => [row.date, row]));
  const dates = Array.from({ length: 7 }, (_, index) => daysAgo(startAgo - index, now));
  const days = dates.flatMap((date) => { const row = map.get(date); return row ? [anonymous(row)] : []; });
  return { start: dates[0]!, end: dates[6]!, totals: sumDays(days), recordedDays: days.length };
}

export function metricChange(current: number, previous: number) {
  return { absolute: current - previous, percent: previous > 0 ? (current - previous) / previous * 100 : null };
}

/** Compare equal, completed calendar windows; never partial today vs full days.
 * Missing rows are unknown coverage, not verified zeros. Even saved rows do
 * not prove continuous collection, so this is a comparison of recorded totals.
 */
export function compareCompleteWeeks(records: DayStats[] | undefined, now = new Date()) {
  const current = completePeriod(records ?? [], 7, now);
  const previous = completePeriod(records ?? [], 14, now);
  const state = records === undefined ? 'unavailable'
    : current.recordedDays < 7 || previous.recordedDays < 7 ? 'insufficient' : 'ready';
  return {
    state, current, previous,
    changes: state === 'ready' ? {
      distancePx: metricChange(current.totals.distancePx, previous.totals.distancePx),
      actions: metricChange(current.totals.actions, previous.totals.actions),
      activeMs: metricChange(current.totals.activeMs, previous.totals.activeMs),
    } : null,
  };
}

export interface HourCell extends DayStats { hour: number; hasRecord: boolean }

/** Aggregate only supplied, opted-in details into site-free view models.
 * No durable hourly store, backfill, identity, or fake coverage is created.
 */
export function hourlyPattern(records: SiteHourStats[], period: InsightPeriod, now = new Date()) {
  const dates = lastSevenDays([], now).map(({ date }) => date);
  const cells: HourCell[] = dates.flatMap((date) => Array.from({ length: 24 }, (_, hour) => ({
    ...emptyDay(date), hour, hasRecord: false,
  })));
  const dayIndexes = new Map(dates.map((date, index) => [date, index]));
  for (const row of records) {
    const day = dayIndexes.get(row.date);
    if (day === undefined || !Number.isInteger(row.hour) || row.hour < 0 || row.hour > 23) continue;
    const cell = cells[day * 24 + row.hour]!;
    cell.distancePx += row.distancePx; cell.actions += row.actions; cell.activeMs += row.activeMs;
    cell.hasRecord = true;
  }
  const hours = Array.from({ length: 24 }, (_, hour) => ({ ...emptyDay('period'), hour }));
  for (const cell of cells) {
    if (period === 'today' && cell.date !== localDate(now)) continue;
    const hour = hours[cell.hour]!;
    hour.distancePx += cell.distancePx; hour.actions += cell.actions; hour.activeMs += cell.activeMs;
  }
  const maximum = Math.max(0, ...hours.map(({ distancePx }) => distancePx));
  return { dates, cells, peakHours: maximum > 0 ? hours.filter(({ distancePx }) => distancePx === maximum) : [] };
}