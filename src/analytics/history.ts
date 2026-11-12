import { daysAgo, localDate, sumDays } from './metrics';
import type { DayStats, RetainedHistory } from '../types';

export type HistoryMetric = 'distancePx' | 'actions' | 'activeMs';
export type DayRecordState = 'recorded' | 'no-record' | 'outside-retention' | 'future';
export interface MonthDay { date: string; state: DayRecordState; stats: DayStats | null }

const anonymous = ({ date, distancePx, actions, activeMs }: DayStats): DayStats => ({ date, distancePx, actions, activeMs });
const parse = (date: string) => new Date(`${date}T12:00:00`);

function savedDays(history: RetainedHistory): DayStats[] {
  return history.days.filter(({ date }) => date >= history.startDate && date <= history.endDate)
    .map(anonymous).sort((a, b) => a.date.localeCompare(b.date));
}

export function retainedRecords(history: RetainedHistory) {
  const days = savedDays(history);
  // Past calendar dates only. Even these rows may contain collection gaps.
  const complete = days.filter(({ date }) => date < history.endDate);
  const peak = (metric: HistoryMetric) => {
    const maximum = Math.max(0, ...complete.map((day) => day[metric]));
    return { value: maximum, dates: maximum > 0 ? complete.filter((day) => day[metric] === maximum).map(({ date }) => date) : [] };
  };
  return {
    startDate: history.startDate, endDate: daysAgo(1, parse(history.endDate)),
    savedDays: days.length, pastSavedDays: complete.length, totals: sumDays(days),
    distancePx: peak('distancePx'), actions: peak('actions'), activeMs: peak('activeMs'),
  };
}

/** At most four calendar months can intersect the existing 90-day window. */
export function retainedMonths(history: RetainedHistory): string[] {
  const current = parse(history.endDate);
  current.setDate(1);
  const months: string[] = [];
  const first = history.startDate.slice(0, 7);
  while (localDate(current).slice(0, 7) >= first && months.length < 4) {
    months.push(localDate(current).slice(0, 7));
    current.setMonth(current.getMonth() - 1);
  }
  return months;
}

export function monthlySummary(history: RetainedHistory, month: string) {
  if (!retainedMonths(history).includes(month)) throw new Error('Month is outside the retained history window.');
  const first = parse(`${month}-01`);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
  const calendarStart = localDate(first); const calendarEnd = localDate(last);
  const startDate = calendarStart < history.startDate ? history.startDate : calendarStart;
  const endDate = calendarEnd > history.endDate ? history.endDate : calendarEnd;
  const map = new Map(savedDays(history).map((day) => [day.date, day]));
  const days: MonthDay[] = Array.from({ length: last.getDate() }, (_, index) => {
    const date = localDate(new Date(first.getFullYear(), first.getMonth(), index + 1, 12));
    const stats = map.get(date);
    const state: DayRecordState = date < history.startDate ? 'outside-retention' : date > history.endDate ? 'future' : stats ? 'recorded' : 'no-record';
    return { date, state, stats: state === 'recorded' ? stats! : null };
  });
  const records = days.flatMap(({ stats }) => stats ? [stats] : []);
  return {
    month, calendarStart, calendarEnd, startDate, endDate, days, firstWeekday: first.getDay(),
    totals: sumDays(records), savedDays: records.length,
    eligibleDays: days.filter(({ state }) => state === 'recorded' || state === 'no-record').length,
    clippedStart: startDate !== calendarStart,
    includesToday: month === history.endDate.slice(0, 7),
  };
}