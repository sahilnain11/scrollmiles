import { daysAgo, emptyDay, lastSevenDays, localDate, sumDays } from '../analytics/metrics';
import type { DayStats } from '../types';

export type WrappedPeriod = 'today' | 'week';

export interface WrappedSnapshot {
  epoch: string;
  capturedAt: number;
  today: DayStats;
  week: DayStats;
  startDate: string;
  endDate: string;
}

export interface WrappedCard {
  period: WrappedPeriod;
  stats: DayStats;
  startDate: string;
  endDate: string;
  filename: string;
}

/** Explicit projection, not a spread of storage objects: no sites in exports. */
function anonymousDay(day: DayStats): DayStats {
  return { date: day.date, distancePx: day.distancePx, actions: day.actions, activeMs: day.activeMs };
}

export function captureWrapped(days: DayStats[], epoch: string, now = new Date()): WrappedSnapshot {
  const week = lastSevenDays(days, now);
  return {
    epoch, capturedAt: now.getTime(),
    today: anonymousDay(week.at(-1) ?? emptyDay(localDate(now))),
    week: anonymousDay(sumDays(week)),
    startDate: daysAgo(6, now), endDate: localDate(now),
  };
}

export function wrappedCard(snapshot: WrappedSnapshot, period: WrappedPeriod): WrappedCard {
  return {
    period, stats: anonymousDay(period === 'today' ? snapshot.today : snapshot.week),
    startDate: period === 'today' ? snapshot.endDate : snapshot.startDate,
    endDate: snapshot.endDate,
    filename: `scrollmiles-${period === 'week' ? 'week' : snapshot.endDate}.png`,
  };
}

export function wrappedDateLabel(card: Pick<WrappedCard, 'period' | 'startDate' | 'endDate'>): string {
  const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return card.period === 'today' ? format(card.endDate) : `${format(card.startDate)} – ${format(card.endDate)}`;
}