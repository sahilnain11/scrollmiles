import { useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, CalendarDays, Clock3, Lightbulb } from 'lucide-react';
import { compareCompleteWeeks, hourlyPattern, scrollingSummary, type InsightMetric, type InsightPeriod } from '../analytics/insights';
import { distanceLabel } from '../analytics/metrics';
import { hourLabel, siteScrollTime } from '../analytics/sites';
import { RELOAD_EXTENSION_MESSAGE } from '../utils/client';
import type { Snapshot } from '../types';

const metricNames: Record<InsightMetric, string> = { distancePx: 'Distance', actions: 'Burst starts', activeMs: 'Active scrolling' };
const metricOrder: InsightMetric[] = ['distancePx', 'actions', 'activeMs'];
const distance = (px: number) => { const value = distanceLabel(px); return `${value.value} ${value.unit}`; };
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const hourRange = (hour: number) => `${hourLabel(hour)}–${hour === 23 ? '24:00' : hourLabel(hour + 1)}`;

function exactValue(value: number, metric: InsightMetric): string {
  return metric === 'distancePx' ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} CSS px`
    : metric === 'activeMs' ? `${value.toLocaleString()} ms` : `${value.toLocaleString()} bursts`;
}

function Comparison({ days, now }: { days: Snapshot['comparisonDays']; now: Date }) {
  const result = compareCompleteWeeks(days, now);
  if (result.state === 'unavailable') return <section className="smart-comparison" aria-labelledby="smart-comparison-heading"><h3 id="smart-comparison-heading">Two complete weeks, side by side</h3><p className="smart-data-note">Comparison history is unavailable from this worker. {RELOAD_EXTENSION_MESSAGE}</p></section>;
  return <section className="smart-comparison" aria-labelledby="smart-comparison-heading">
    <div className="smart-subheading"><div><h3 id="smart-comparison-heading">Two complete weeks, side by side</h3><p>Last 7 complete local days versus the 7 before them. Today is excluded from both windows.</p></div><CalendarDays size={18} aria-hidden="true" /></div>
    <div className="smart-periods">
      <div><span>Recent complete period</span><strong>{result.current.start} – {result.current.end}</strong><p>{distance(result.current.totals.distancePx)} recorded · {result.current.recordedDays}/7 days with saved aggregates</p></div>
      <div><span>Previous complete period</span><strong>{result.previous.start} – {result.previous.end}</strong><p>{distance(result.previous.totals.distancePx)} recorded · {result.previous.recordedDays}/7 days with saved aggregates</p></div>
    </div>
    {!result.changes ? <p className="smart-data-note">Not enough comparable history yet. A saved aggregate is needed for each of the 14 complete days before changes are calculated. A missing day could mean no scrolling, a pause, or no collection—not a verified zero. No percentage is inferred.</p>
        : <div className="smart-changes">{metricOrder.map((metric) => {
          const change = result.changes![metric];
          const percent = change.percent === null ? 'No percentage: previous total is zero'
            : change.absolute === 0 ? '0% change'
              : `${Math.abs(change.percent) < 0.1 ? '<0.1' : Math.abs(change.percent).toLocaleString(undefined, { maximumFractionDigits: 1 })}% ${change.absolute > 0 ? 'more' : 'less'} recorded`;
          return <div key={metric}><h4>{metricNames[metric]}</h4><strong>{change.absolute === 0 ? 'Unchanged' : `${exactValue(Math.abs(change.absolute), metric)} ${change.absolute > 0 ? 'more' : 'less'}`}</strong><span>{percent}</span></div>;
        })}</div>}
    <p className="smart-caveat">Recorded totals, not a measure of improvement. Even saved days may include gaps; changes in permissions, pauses or collection can affect comparisons.</p>
  </section>;
}

function ActivityHeatmap({ snapshot, period, now }: { snapshot: Snapshot; period: InsightPeriod; now: Date }) {
  const [metric, setMetric] = useState<InsightMetric>('distancePx');
  const pattern = hourlyPattern(snapshot.siteHours ?? [], period, now);
  const [selection, setSelection] = useState(6 * 24);
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const maximum = Math.max(0, ...pattern.cells.map((cell) => cell[metric]));
  const selected = pattern.cells[selection]!;
  const value = (amount: number) => metric === 'distancePx' ? distance(amount) : metric === 'activeMs' ? siteScrollTime(amount) : `${amount.toLocaleString()} burst starts`;
  return <section className="smart-heatmap" aria-labelledby="smart-heatmap-heading">
    <div className="smart-subheading"><div><h3 id="smart-heatmap-heading">Your scrolling rhythm</h3><p>Last 7 local dates · opted-in recorded-site totals only · today is partial</p></div><label className="smart-metric">Heatmap metric<select value={metric} onChange={(event) => setMetric(event.target.value as InsightMetric)}>{metricOrder.map((key) => <option key={key} value={key}>{metricNames[key]}</option>)}</select></label></div>
    <p id="smart-heatmap-help" className="smart-caveat">Tab into the grid; arrow keys move between hours and days. Home/End move within a day; Ctrl+Home/End move to the first/last cell. On small screens, scroll the grid sideways.</p>
    <div className="smart-grid-scroll">
      <div className="smart-hour-grid" role="grid" aria-label={`Seven-day recorded-site heatmap: ${metricNames[metric].toLowerCase()}`} aria-describedby="smart-heatmap-help" aria-rowcount={8} aria-colcount={25}>
        <div className="smart-grid-row" role="row"><span role="columnheader">Date / hour</span>{Array.from({ length: 24 }, (_, hour) => <span role="columnheader" aria-label={hourRange(hour)} key={hour}>{String(hour).padStart(2, '0')}</span>)}</div>
        {pattern.dates.map((date, dayIndex) => <div className="smart-grid-row" role="row" key={date}>
          <span role="rowheader" aria-label={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          {pattern.cells.slice(dayIndex * 24, (dayIndex + 1) * 24).map((cell, hour) => {
            const index = dayIndex * 24 + hour;
            const level = cell[metric] <= 0 || maximum <= 0 ? 0 : Math.max(1, Math.ceil(cell[metric] / maximum * 4));
            return <button key={hour} role="gridcell" ref={(element) => { controls.current[index] = element; }} className="smart-hour-cell" data-level={level} tabIndex={index === selection ? 0 : -1} aria-selected={index === selection} aria-label={`${date}, ${hourRange(hour)}: ${cell.hasRecord ? exactValue(cell[metric], metric) : 'no recorded detail; coverage unknown'}`} onFocus={() => setSelection(index)} onClick={() => setSelection(index)} onKeyDown={(event) => {
              let next: number;
              if (event.key === 'ArrowRight') next = dayIndex * 24 + Math.min(23, hour + 1);
              else if (event.key === 'ArrowLeft') next = dayIndex * 24 + Math.max(0, hour - 1);
              else if (event.key === 'ArrowDown') next = Math.min(6, dayIndex + 1) * 24 + hour;
              else if (event.key === 'ArrowUp') next = Math.max(0, dayIndex - 1) * 24 + hour;
              else if (event.key === 'Home') next = event.ctrlKey || event.metaKey ? 0 : dayIndex * 24;
              else if (event.key === 'End') next = event.ctrlKey || event.metaKey ? 167 : dayIndex * 24 + 23;
              else return;
              event.preventDefault(); setSelection(next); controls.current[next]?.focus();
            }} />;
          })}
        </div>)}
      </div>
    </div>
    <div className="smart-heatmap-legend"><span>No recorded value</span><span className="smart-legend-cells" aria-hidden="true">{[0, 1, 2, 3, 4].map((level) => <i className="smart-hour-cell" data-level={level} key={level} />)}</span><span>{maximum > 0 ? `${value(maximum)} maximum` : 'No activity for this metric'}</span></div>
    <p className="smart-heatmap-readout" aria-live="polite"><strong>{selected.date} · {hourRange(selected.hour)}</strong><span>{selected.hasRecord ? `${value(selected[metric])} · ${exactValue(selected[metric], metric)}` : 'No recorded detail for this hour. This does not prove inactivity.'}</span></p>
    <p className="smart-caveat">Blank cells are not confirmed inactivity: opt-in timing, pauses, exclusions, deletion and future hours can leave gaps. Zero timed seconds can still include distance. Hours keep their collection-time labels; repeated DST hours merge and timezone travel does not regroup old data.</p>
    <details className="smart-exact"><summary>View exact heatmap values</summary><div className="smart-exact-scroll"><table><caption className="sr-only">Seven-day recorded-site hourly totals</caption><thead><tr><th scope="col">Local date</th><th scope="col">Local hour</th><th scope="col">CSS pixels</th><th scope="col">Burst starts</th><th scope="col">Active ms</th><th scope="col">Detail</th></tr></thead><tbody>{pattern.cells.map((cell) => <tr key={`${cell.date}:${cell.hour}`}><th scope="row">{cell.date}</th><td>{hourRange(cell.hour)}</td><td>{cell.distancePx.toLocaleString()}</td><td>{cell.actions.toLocaleString()}</td><td>{cell.activeMs.toLocaleString()}</td><td>{cell.hasRecord ? 'Recorded' : 'No record; coverage unknown'}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function SmartInsights({ snapshot, period, stale, now = new Date() }: { snapshot: Snapshot; period: InsightPeriod; stale: boolean; now?: Date }) {
  const summary = scrollingSummary(snapshot.days, period, now);
  // Never even derive hourly observations from a stale/disabled consent view.
  const hourlyAvailable = !stale && snapshot.settings.siteInsightsEnabled && snapshot.siteHours !== undefined;
  const peak = hourlyAvailable ? hourlyPattern(snapshot.siteHours!, period, now).peakHours : [];
  const firstPeak = summary.peakDays[0];
  return <section id="smart-insights" className="panel smart-insights" aria-labelledby="smart-insights-heading">
    <div className="smart-heading"><div><div className="eyebrow"><Lightbulb size={14} aria-hidden="true" /> A LITTLE DATA. A LITTLE PERSPECTIVE.</div><h2 id="smart-insights-heading">Smart insights</h2><p>Deterministic observations from your recorded scrolling. No guesses about attention or time online.</p></div><span className="smart-scope">{summary.start} – {summary.end}<small>{period === 'today' ? 'Today so far' : 'Last 7 days, including partial today'}</small></span></div>
    {stale ? <p className="smart-data-note">Insights are unavailable while statistics or tracking status cannot be verified. Retry loading above; previous totals are not treated as fresh observations.</p> : <>
      <div className="smart-cards">
        <article><BarChart3 size={17} aria-hidden="true" /><h3>Recorded scrolls</h3><strong>{distance(summary.totals.distancePx)}</strong><p>{summary.totals.actions.toLocaleString()} bursts · {siteScrollTime(summary.totals.activeMs)} active scrolling</p><small>{summary.recordedDays === 0 ? 'No scrolling recorded in this period. No pattern inferred.' : `${summary.recordedDays} ${summary.recordedDays === 1 ? 'date has' : 'dates have'} recorded movement. This is not a streak or a goal.`}</small></article>
        <article><CalendarDays size={17} aria-hidden="true" /><h3>{period === 'today' ? 'Today’s recording' : 'Most distance recorded'}</h3><strong>{!firstPeak ? 'No recorded day yet' : summary.peakDays.length > 1 ? `${summary.peakDays.length} days tied` : dateLabel(firstPeak.date)}</strong><p>{firstPeak ? `${distance(firstPeak.distancePx)}${period === 'week' ? ' on the leading date' : ' recorded so far'}` : 'An empty record is not a habit assessment.'}</p><small>{summary.peakDays.length > 1 ? summary.peakDays.map(({ date }) => date).join(' · ') : 'Specific dates in this period—not a claim about your usual weekday. Today is still in progress.'}</small></article>
        <article><Clock3 size={17} aria-hidden="true" /><h3>Peak recorded hour</h3><strong>{!hourlyAvailable ? 'Hourly detail unavailable' : !peak.length ? 'No recorded peak yet' : peak.length === 1 ? hourRange(peak[0]!.hour) : `${peak.length} hours tied`}</strong><p>{peak.length > 0 ? `${distance(peak[0]!.distancePx)} recorded-site distance${period === 'week' ? ', summed across 7 days' : ', today so far'}` : 'Daily anonymous totals cannot reveal an hour.'}</p><small>{peak.length > 1 ? peak.map(({ hour }) => hourRange(hour)).join(' · ') : 'Based only on retained, opted-in site/hour records—not all browser activity.'}</small></article>
      </div>
      <Comparison days={snapshot.comparisonDays} now={now} />
      {hourlyAvailable ? <ActivityHeatmap snapshot={snapshot} period={period} now={now} /> : <div className="smart-hourly-off"><Clock3 size={22} aria-hidden="true" /><div><h3>A heatmap needs hourly detail</h3><p>{snapshot.settings.siteInsightsEnabled ? 'This worker did not supply hourly records. Reload ScrollMiles to use the current build.' : 'Website insights is off. Daily anonymous history cannot be split into hours. Only new scrolling after a separate opt-in can appear here.'}</p><a href="options.html">Review Website insights in privacy settings<ArrowUpRight size={13} aria-hidden="true" /></a></div></div>}
      <p className="smart-caveat smart-method">Observations are calculated on this device, not saved as new history. No new tracking or permissions. A longest individual burst, sessions, attention scores and typical-weekday claims cannot be reconstructed from these aggregates.</p>
    </>}
  </section>;
}