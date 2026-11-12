import { useRef, useState } from 'react';
import { CalendarDays, Footprints, History, Mouse, Timer } from 'lucide-react';
import { monthlySummary, retainedMonths, retainedRecords, type DayRecordState, type HistoryMetric } from '../analytics/history';
import { distanceLabel } from '../analytics/metrics';
import { siteScrollTime } from '../analytics/sites';
import { RELOAD_EXTENSION_MESSAGE } from '../utils/client';
import type { RetainedHistory } from '../types';

const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const distance = (px: number) => { const result = distanceLabel(px); return `${result.value} ${result.unit}`; };
const stateLabels: Record<DayRecordState, string> = {
  recorded: 'Saved aggregate', 'no-record': 'No saved record; coverage unknown',
  'outside-retention': 'Outside the retained window', future: 'Future date; not measured',
};
const recordNames: Record<HistoryMetric, string> = {
  distancePx: 'Most distance in a day', actions: 'Most bursts in a day', activeMs: 'Most active scrolling in a day',
};
const metricOrder: HistoryMetric[] = ['distancePx', 'actions', 'activeMs'];

function MonthlyCalendar({ summary, today }: { summary: ReturnType<typeof monthlySummary>; today: string }) {
  const [selection, setSelection] = useState(summary.includesToday ? Number(today.slice(-2)) - 1 : summary.days.length - 1);
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = summary.days[Math.min(selection, summary.days.length - 1)]!;
  const maximum = Math.max(0, ...summary.days.map(({ stats }) => stats?.distancePx ?? 0));
  const weeks = Math.ceil((summary.firstWeekday + summary.days.length) / 7);
  const weekdayNames = Array.from({ length: 7 }, (_, index) => new Date(2026, 10, 1 + index, 12).toLocaleDateString(undefined, { weekday: 'short' }));
  return <div className="history-calendar-area">
    <p id="history-calendar-help" className="history-note">Calendar starts Sunday. Tab into a date; arrow keys move by day/week. Home/End move to the row’s first/last date; Ctrl+Home/End move to the month’s first/last date.</p>
    <table className="history-calendar" aria-describedby="history-calendar-help">
      <caption className="sr-only">Monthly recorded distance calendar — {monthLabel(summary.month)}</caption>
      <thead><tr>{weekdayNames.map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
      <tbody>{Array.from({ length: weeks }, (_, week) => <tr key={week}>{Array.from({ length: 7 }, (_, weekday) => {
        const index = week * 7 + weekday - summary.firstWeekday;
        const day = summary.days[index];
        if (!day) return <td key={weekday} />;
        const level = day.stats && day.stats.distancePx > 0 && maximum > 0 ? Math.max(1, Math.ceil(day.stats.distancePx / maximum * 4)) : 0;
        return <td key={weekday}><button ref={(element) => { controls.current[index] = element; }} className="history-date" data-state={day.state} data-level={level} tabIndex={index === selection ? 0 : -1} aria-pressed={day.date === selected.date} aria-current={day.date === today ? 'date' : undefined} aria-label={`${index + 1}, ${day.date}: ${stateLabels[day.state]}${day.stats ? `, ${day.stats.distancePx.toLocaleString()} CSS px` : ''}${day.date === today ? ', today still in progress' : ''}`} onClick={() => setSelection(index)} onFocus={() => setSelection(index)} onKeyDown={(event) => {
          let next: number;
          if (event.key === 'ArrowRight') next = Math.min(summary.days.length - 1, index + 1);
          else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
          else if (event.key === 'ArrowDown') next = Math.min(summary.days.length - 1, index + 7);
          else if (event.key === 'ArrowUp') next = Math.max(0, index - 7);
          else if (event.key === 'Home') next = event.ctrlKey || event.metaKey ? 0 : Math.max(0, index - weekday);
          else if (event.key === 'End') next = event.ctrlKey || event.metaKey ? summary.days.length - 1 : Math.min(summary.days.length - 1, index + 6 - weekday);
          else return;
          event.preventDefault(); setSelection(next); controls.current[next]?.focus();
        }}><span>{index + 1}</span><i aria-hidden="true" /></button></td>;
      })}</tr>)}</tbody>
    </table>
    <div className="history-calendar-legend"><span><i data-level="0" />No distance value</span><span><i data-level="4" />More recorded distance</span><small>Color is relative to this month, not a goal.</small></div>
    <div className="history-day-readout" aria-live="polite"><strong>{selected.date}{selected.date === today ? ' · Today so far' : ''}</strong><p>{stateLabels[selected.state]}</p>{selected.stats && <dl><div><dt>Estimated distance</dt><dd>{distance(selected.stats.distancePx)}</dd></div><div><dt>Bursts</dt><dd>{selected.stats.actions.toLocaleString()}</dd></div><div><dt>Active scrolling</dt><dd>{siteScrollTime(selected.stats.activeMs)}</dd></div></dl>}{selected.state === 'no-record' && <p>No saved record does not prove zero activity. Pauses, permissions or collection gaps may be involved.</p>}</div>
  </div>;
}

function HistoryContent({ history }: { history: RetainedHistory }) {
  const months = retainedMonths(history);
  const [chosenMonth, setMonth] = useState(months[0]!);
  const month = months.includes(chosenMonth) ? chosenMonth : months[0]!;
  const summary = monthlySummary(history, month);
  const records = retainedRecords(history);
  return <>
    <div className="history-retained-strip"><span><strong>{distance(records.totals.distancePx)}</strong> saved distance</span><span><strong>{records.savedDays}</strong> dates with saved aggregates</span><span>Includes today so far · not lifetime totals</span></div>
    <section className="history-records" aria-labelledby="history-records-heading">
      <div className="history-subheading"><div><h3 id="history-records-heading">Personal records within retained history</h3><p>Past dates only: {records.startDate} – {records.endDate}. Today is excluded while still in progress.</p></div><Footprints size={18} aria-hidden="true" /></div>
      <div className="history-record-grid">{metricOrder.map((metric) => {
        const record = records[metric];
        const Icon = metric === 'distancePx' ? Footprints : metric === 'actions' ? Mouse : Timer;
        const value = metric === 'distancePx' ? distance(record.value) : metric === 'activeMs' ? siteScrollTime(record.value) : `${record.value.toLocaleString()} bursts`;
        return <article key={metric}><Icon size={17} aria-hidden="true" /><h4>{recordNames[metric]}</h4><strong>{record.dates.length ? value : 'No positive record yet'}</strong><p>{record.dates.length === 1 ? record.dates[0] : record.dates.length > 1 ? `${record.dates.length} dates tied` : records.pastSavedDays ? 'No positive total for this metric on a past saved date.' : 'No past dates with saved aggregates yet.'}</p>{record.dates.length > 0 && <small>{metric === 'distancePx' ? `${record.value.toLocaleString()} CSS px` : metric === 'activeMs' ? `${record.value.toLocaleString()} ms · daily total, not a single burst` : 'Daily burst count, not session count'}</small>}{record.dates.length > 1 && <details><summary>View tied dates for {metric === 'distancePx' ? 'distance' : metric === 'activeMs' ? 'active scrolling' : 'bursts'}</summary><ul>{record.dates.map((date) => <li key={date}>{date}</li>)}</ul></details>}</article>;
      })}</div>
      <p className="history-note">Observed maxima, not targets or achievements. Saved dates can contain gaps; records can change as late checkpoints arrive or older days expire. These aggregates cannot reveal your longest individual burst.</p>
    </section>
    <section className="history-month" aria-labelledby="history-month-heading">
      <div className="history-subheading"><div><h3 id="history-month-heading">Monthly summary</h3><p>Calendar-month totals from saved anonymous aggregates. Independent of the Today / Last 7 days switch.</p></div><label className="history-month-select">Month<select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((value) => <option value={value} key={value}>{monthLabel(value)}</option>)}</select></label></div>
      <div className="history-month-heading"><CalendarDays size={20} aria-hidden="true" /><div><h4>{monthLabel(month)}</h4><p>Included dates: {summary.startDate} – {summary.endDate}{summary.includesToday ? ' · today is partial' : ''}</p></div></div>
      {summary.clippedStart && <p className="history-data-note">This month starts before the retained window. Earlier dates are outside retention and are excluded—not counted as zero.</p>}
      <dl className="history-month-totals"><div><dt>Saved distance</dt><dd>{distance(summary.totals.distancePx)}<small>{summary.totals.distancePx.toLocaleString()} CSS px · estimated screen equivalent</small></dd></div><div><dt>Saved bursts</dt><dd>{summary.totals.actions.toLocaleString()}<small>Burst starts, not sessions</small></dd></div><div><dt>Saved active scrolling</dt><dd>{siteScrollTime(summary.totals.activeMs)}<small>Not time online</small></dd></div></dl>
      <p className="history-note">{summary.savedDays} dates with saved aggregates / {summary.eligibleDays} dates within the displayed window. This is not a collection-coverage percentage. Missing dates do not prove inactivity; no daily averages, streaks or month-to-month changes are inferred.</p>
      {summary.savedDays === 0 && <p className="history-data-note">No saved totals for this month. The recorded subtotal is zero; that is not proof of no activity.</p>}
      <div className="history-month-layout"><MonthlyCalendar key={month} summary={summary} today={history.endDate} /><div className="history-month-notes"><h4>A month, without filling in the blanks.</h4><p>Select a date to inspect saved totals or its missing-data status. An explicit saved zero and a missing record are different states.</p><p>Past calendar dates may still have collection gaps. Dates before retention and future dates are labeled separately. Historical local dates are not shifted after timezone travel.</p><p>Anonymous summaries work while Website insights is off. Detailed-history deletion does not subtract these totals; Delete history clears them with the rest of your anonymous history.</p></div></div>
      <details className="history-exact"><summary>View exact monthly totals</summary><div className="history-table-scroll"><table><caption className="sr-only">Monthly anonymous daily totals — {monthLabel(month)}</caption><thead><tr><th scope="col">Local date</th><th scope="col">Status</th><th scope="col">CSS pixels</th><th scope="col">Bursts</th><th scope="col">Active ms</th></tr></thead><tbody>{summary.days.map((day) => <tr key={day.date}><th scope="row">{day.date}{day.date === history.endDate ? ' (partial today)' : ''}</th><td>{stateLabels[day.state]}</td><td>{day.stats ? day.stats.distancePx.toLocaleString() : '—'}</td><td>{day.stats ? day.stats.actions.toLocaleString() : '—'}</td><td>{day.stats ? day.stats.activeMs.toLocaleString() : '—'}</td></tr>)}</tbody></table></div></details>
    </section>
  </>;
}

export function HistoryOverview({ history, stale }: { history: RetainedHistory | undefined; stale: boolean }) {
  return <section id="history" className="panel history-overview" aria-labelledby="history-heading">
    <div className="history-heading"><div><div className="eyebrow"><History size={14} aria-hidden="true" /> THE BIGGER PICTURE. STILL YOURS.</div><h2 id="history-heading">Your recent history</h2><p>Personal daily records and monthly summaries from existing local totals.</p></div>{history && !stale && <span>{history.startDate} – {history.endDate}<small>90-local-date retention window</small></span>}</div>
    {stale ? <p className="history-data-note">History observations are unavailable while statistics cannot be verified. Retry loading above before treating saved totals as current.</p> : !history ? <p className="history-data-note">Retained history is unavailable from this worker. {RELOAD_EXTENSION_MESSAGE}</p> : <HistoryContent history={history} />}
  </section>;
}