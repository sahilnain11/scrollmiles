import { emptyDay, lastSevenDays, localDate } from './metrics';
import type { DayStats, SiteHourStats } from '../types';

export function addStats(target: DayStats, value: DayStats): void {
  target.distancePx += value.distancePx;
  target.actions += value.actions;
  target.activeMs += value.activeMs;
}

export function siteSummaries(hours: SiteHourStats[], period: 'today' | 'week', today = localDate()) {
  const sites = new Map<string, DayStats & { site: string }>();
  for (const row of hours) {
    if (period === 'today' && row.date !== today) continue;
    const total = sites.get(row.site) ?? { ...emptyDay('period'), site: row.site };
    addStats(total, row);
    sites.set(row.site, total);
  }
  return [...sites.values()].sort((a, b) => b.distancePx - a.distancePx || a.site.localeCompare(b.site));
}

export function siteHoursForPeriod(hours: SiteHourStats[], site: string, period: 'today' | 'week', today = localDate()) {
  const totals = Array.from({ length: 24 }, (_, hour) => ({ ...emptyDay('period'), hour }));
  for (const row of hours) {
    if (row.site === site && (period === 'week' || row.date === today)) addStats(totals[row.hour]!, row);
  }
  return totals;
}

export function siteDays(hours: SiteHourStats[], site: string, now = new Date()): DayStats[] {
  const days = new Map<string, DayStats>();
  for (const row of hours) {
    if (row.site !== site) continue;
    const total = days.get(row.date) ?? emptyDay(row.date);
    addStats(total, row);
    days.set(row.date, total);
  }
  return lastSevenDays([...days.values()], now);
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}