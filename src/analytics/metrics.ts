import type { DayStats } from '../types';

export const RETENTION_DAYS = 90;
export const BURST_GAP_MS = 2_000;
export const CSS_PX_PER_METRE = 96 / 0.0254;

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function daysAgo(count: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - count);
  return localDate(date);
}

export function emptyDay(date: string): DayStats {
  return { date, distancePx: 0, actions: 0, activeMs: 0 };
}

export function lastSevenDays(records: DayStats[], now = new Date()): DayStats[] {
  const map = new Map(records.map((record) => [record.date, record]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = daysAgo(6 - index, now);
    return map.get(date) ?? emptyDay(date);
  });
}

export function sumDays(days: DayStats[]): DayStats {
  return days.reduce((total, day) => ({
    date: 'week',
    distancePx: total.distancePx + day.distancePx,
    actions: total.actions + day.actions,
    activeMs: total.activeMs + day.activeMs,
  }), emptyDay('week'));
}

export function distanceLabel(px: number): { value: string; unit: string } {
  const metres = px / CSS_PX_PER_METRE;
  return metres >= 1_000
    ? { value: (metres / 1_000).toLocaleString(undefined, { maximumFractionDigits: 2 }), unit: 'km' }
    : { value: metres.toLocaleString(undefined, { maximumFractionDigits: 1 }), unit: 'm' };
}

export function durationLabel(ms: number): string {
  if (ms < 1_000) return '0s';
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s`;
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}