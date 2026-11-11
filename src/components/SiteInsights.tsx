import { useRef, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, BarChart3, Clock3, Globe2, LockKeyhole, Mouse, Search, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import { distanceLabel } from '../analytics/metrics';
import { hourLabel, siteDays, siteHoursForPeriod, siteIdentity, siteScrollTime, siteSummaries } from '../analytics/sites';
import { RELOAD_EXTENSION_MESSAGE, send } from '../utils/client';
import type { DayStats, Snapshot } from '../types';

interface Props {
  snapshot: Snapshot;
  disabled: boolean;
  run(work: () => Promise<unknown>, notice?: string): Promise<void>;
}

export function SiteInsightsControl({ snapshot, disabled, run }: Props) {
  const [confirm, setConfirm] = useState(false);
  const supported = snapshot.capabilities?.siteInsights === true;
  const enabled = snapshot.settings.siteInsightsEnabled;
  return <section className="panel insight-control" aria-labelledby="insight-consent-heading">
    <div className="section-heading"><div><div className="eyebrow"><ShieldCheck size={14} /> OPTIONAL · LOCAL ONLY</div><h2 id="insight-consent-heading">Website insights</h2></div><BarChart3 size={22} /></div>
    <p>Keep scrolling totals grouped by website and hour—not just a combined daily number. This records more detail about your browsing, so it is off by default.</p>
    {!supported ? <p className="muted small">{RELOAD_EXTENSION_MESSAGE}</p> : enabled ? <>
      <p className="insight-consent-note">Enabled{snapshot.settings.siteInsightsSince ? ` since ${new Date(snapshot.settings.siteInsightsSince).toLocaleString()}` : ''}. Earlier anonymous activity is not assigned to websites. Pausing and website exclusions still apply.</p>
      <div className="insight-control-actions"><a className="button ghost" href="dashboard.html#website-insights">View website insights<ArrowUpRight size={14} /></a><button className="button danger" disabled={disabled} onClick={() => {
        void run(() => send({ type: 'SET_SITE_INSIGHTS', enabled: false }), 'Website insights turned off and detailed history deleted. Anonymous totals are unchanged.');
      }}>Turn off & delete website insights</button></div>
    </> : confirm ? <div className="insight-confirm" role="group" aria-label="Confirm website insights">
      <p><strong>Save exact scheme/hostnames with hourly scrolling totals on this device for up to 90 days.</strong> No paths, video IDs, page titles, text, or browsing sessions are stored. All currently enabled sites are included; use permissions/exclusions to avoid sensitive websites.</p>
      <p>Only new activity is detailed. Turning this off deletes all website details but keeps anonymous totals. Wrapped exports remain hostname-free. No additional Chrome permission is requested.</p>
      <div className="insight-control-actions"><button className="button ghost" disabled={disabled} onClick={() => setConfirm(false)}>Keep anonymous totals only</button><button className="button primary" disabled={disabled} onClick={() => {
        void run(async () => { await send({ type: 'SET_SITE_INSIGHTS', enabled: true }); setConfirm(false); }, 'Website insights enabled for new scrolling. Earlier anonymous history stays unchanged.');
      }}>Enable website insights</button></div>
    </div> : <button className="button ghost" disabled={disabled} onClick={() => setConfirm(true)}>Set up website insights</button>}
  </section>;
}

function formattedDistance(px: number): string {
  const distance = distanceLabel(px);
  return `${distance.value} ${distance.unit}`;
}

type ChartMetric = 'distancePx' | 'activeMs' | 'actions';
type SiteSort = 'distancePx' | 'activeMs' | 'actions';
const metricNames: Record<ChartMetric, string> = { distancePx: 'Distance', activeMs: 'Scrolling time', actions: 'Burst starts' };

function metricValue(value: number, metric: ChartMetric): string {
  return metric === 'distancePx' ? formattedDistance(value) : metric === 'activeMs' ? siteScrollTime(value) : value.toLocaleString();
}

function Breakdown({ rows, metric, hourly, period }: { rows: DayStats[]; metric: ChartMetric; hourly: boolean; period: 'today' | 'week' }) {
  const title = hourly ? 'Hourly rhythm' : 'Seven-day trend';
  const maximum = Math.max(0, ...rows.map((row) => row[metric]));
  const peakIndex = rows.findIndex((row) => row[metric] === maximum);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, peakIndex));
  const bars = useRef<(HTMLButtonElement | null)[]>([]);
  const active = rows[activeIndex]!;
  const label = (row: DayStats, index: number) => hourly
    ? `${hourLabel(index)}–${hourLabel((index + 1) % 24)}`
    : new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return <section className="insight-breakdown" aria-label={title}>
    <div className="insight-chart-heading"><div><h4>{title}</h4><p>{hourly ? period === 'today' ? 'Today, by local hour' : 'Each local hour, combined across 7 days' : 'Last 7 local calendar days'} · {metricNames[metric].toLowerCase()}</p></div><span className="insight-scale">{maximum > 0 ? metricValue(maximum, metric) : 'No activity'}<small>chart maximum</small></span></div>
    <div className="insight-plot" role="group" aria-label={`${title}: ${metricNames[metric].toLowerCase()}. Use Left and Right arrow keys to explore exact values.`}>
      <div className="insight-gridlines" aria-hidden="true"><span /><span /><span /></div>
      <div className="insight-bars">
        {rows.map((row, index) => <div className="insight-column" key={index}>
          <button ref={(element) => { bars.current[index] = element; }} className={`insight-bar-button${index === activeIndex ? ' active-bar' : ''}`} tabIndex={index === activeIndex ? 0 : -1} aria-label={`${label(row, index)}: ${metricValue(row[metric], metric)} ${metricNames[metric].toLowerCase()}`} aria-pressed={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)} onKeyDown={(event) => {
            let next: number;
            if (event.key === 'ArrowRight') next = (index + 1) % rows.length;
            else if (event.key === 'ArrowLeft') next = (index + rows.length - 1) % rows.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = rows.length - 1;
            else return;
            event.preventDefault(); setActiveIndex(next); bars.current[next]?.focus();
          }}><span className="insight-bar" style={{ height: `${maximum > 0 ? row[metric] / maximum * 100 : 0}%` }} /></button>
          <span className={index === activeIndex ? 'current-tick' : ''}>{hourly ? index % 4 === 0 ? hourLabel(index).slice(0, 2) : '' : new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
        </div>)}
      </div>
      {maximum === 0 && <p className="insight-chart-empty">{metric === 'activeMs' ? 'No timed interval in this period. Scroll distance can still be recorded.' : 'No activity for this metric in the selected period.'}</p>}
    </div>
    <div className="insight-readout"><span>{label(active, activeIndex)}</span><strong>{metricValue(active[metric], metric)} <small>{metricNames[metric].toLowerCase()}</small></strong><span>Hover or use arrow keys to explore</span></div>
    <details className="insight-table"><summary>View {title.toLowerCase()} values</summary><div className="insight-table-scroll"><table><caption className="sr-only">{title} — exact scrolling totals</caption><thead><tr><th scope="col">{hourly ? 'Local hour' : 'Date'}</th><th scope="col">CSS pixels</th><th scope="col">Burst starts</th><th scope="col">Active scrolling</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><th scope="row">{hourly ? hourLabel(index) : row.date}</th><td>{Math.round(row.distancePx).toLocaleString()}</td><td>{row.actions.toLocaleString()}</td><td>{siteScrollTime(row.activeMs)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function SiteInsights({ snapshot, disabled, run, period, onPeriodChange }: Props & { period: 'today' | 'week'; onPeriodChange(period: 'today' | 'week'): void }) {
  const [selected, setSelected] = useState('');
  const [deleteSite, setDeleteSite] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SiteSort>('distancePx');
  const [metric, setMetric] = useState<ChartMetric>('distancePx');
  const [chartView, setChartView] = useState<'hour' | 'day'>('hour');
  const summaries = siteSummaries(snapshot.siteHours ?? [], period);
  const matches = [...summaries].filter((site) => site.site.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => b[sort] - a[sort] || a.site.localeCompare(b.site));
  const current = matches.find((site) => site.site === selected) ?? matches[0]
    ?? summaries.find((site) => site.site === selected) ?? summaries[0];
  const hours = current ? siteHoursForPeriod(snapshot.siteHours ?? [], current.site, period) : [];
  const busiest = hours.reduce<(typeof hours)[number] | undefined>((top, hour) => !top || hour.distancePx > top.distancePx ? hour : top, undefined);
  const identity = current ? siteIdentity(current.site) : undefined;
  const totalDistance = summaries.reduce((total, site) => total + site.distancePx, 0);
  const totalActiveMs = summaries.reduce((total, site) => total + site.activeMs, 0);
  const share = current && totalDistance > 0 ? current.distancePx / totalDistance * 100 : 0;
  const peakValue = Math.max(1, ...summaries.map((site) => site[sort]));
  return <section id="website-insights" className="panel site-insights" aria-labelledby="website-insights-heading">
    <div className="section-heading insight-heading"><div><div className="eyebrow"><Globe2 size={14} /> YOUR CORNER OF THE INTERNET</div><h2 id="website-insights-heading">A little more perspective.</h2><p>Where your scrolling happens. Not how long you spend online.</p></div><div className="insight-period" role="group" aria-label="Website insights period"><button aria-label="Today: website insights" aria-pressed={period === 'today'} onClick={() => onPeriodChange('today')}>Today</button><button aria-label="Last 7 days: website insights" aria-pressed={period === 'week'} onClick={() => onPeriodChange('week')}>Last 7 days</button></div></div>
    {!snapshot.settings.siteInsightsEnabled ? <div className="insights-empty"><BarChart3 size={25} /><h3>Anonymous until you choose otherwise.</h3><p>Website insights are off. Enable them to save website/hour totals locally for new activity. Your existing combined history cannot be split retrospectively.</p><a className="button ghost" href="options.html">Choose in privacy settings<ArrowUpRight size={14} /></a></div> : !current ? <div className="insights-empty"><BarChart3 size={25} /><h3>No website activity for this period yet.</h3><p>Scroll on an enabled, visible website to start. Watching a video without scrolling adds no active scrolling time. Paused, excluded, earlier anonymous, or deleted site activity will not appear here.</p><a href="options.html" className="text-link">Manage tracking and privacy<ArrowUpRight size={14} /></a></div> : <>
      <div className="insight-overview-strip"><span><strong>{summaries.length}</strong> {summaries.length === 1 ? 'website recorded' : 'websites recorded'}</span><span><strong>{formattedDistance(totalDistance)}</strong> recorded-site distance</span><span><strong>{siteScrollTime(totalActiveMs)}</strong> active scrolling</span><span><LockKeyhole size={12} />On this device</span></div>
      <div className="insights-layout"><aside className="insight-browser"><div className="insight-browser-heading"><h3>Websites <span>{summaries.length}</span></h3><ArrowDownUp size={14} /></div><label className="insight-search"><Search size={14} /><span className="sr-only">Find a recorded website</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a website" maxLength={300} /></label><label className="insight-sort"><span>Sort by</span><select aria-label="Sort websites by" value={sort} onChange={(event) => setSort(event.target.value as SiteSort)}><option value="distancePx">Distance</option><option value="activeMs">Scrolling time</option><option value="actions">Burst starts</option></select></label>
      <nav className="insight-site-list" aria-label="Choose a website to analyze">{matches.map((site, index) => { const name = siteIdentity(site.site); return <button key={site.site} className={site.site === current.site ? 'insight-site selected-site' : 'insight-site'} aria-pressed={site.site === current.site} disabled={disabled} onClick={() => { setSelected(site.site); setDeleteSite(''); }}><span className="insight-rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="insight-avatar" aria-hidden="true">{name.initials}</span><span className="insight-site-copy"><span className="insight-site-name">{name.hostname}</span><span className="sr-only">{site.site}</span><small>{name.protocol} · {site.activeMs === 0 ? 'Brief scrolls' : `${siteScrollTime(site.activeMs)} scrolling`}</small><span className="insight-site-track" aria-hidden="true"><span style={{ width: `${site[sort] / peakValue * 100}%` }} /></span></span><strong>{metricValue(site[sort], sort)}</strong></button>; })}</nav>{matches.length === 0 && <p className="insight-search-empty" role="status">No websites match “{search}”. Try another hostname.</p>}<p className="insight-sidebar-note">Exact hosts stay separate.<br />Only opted-in scrolling is included.</p></aside>
      <div className="insight-detail"><div className="insight-detail-heading"><span className="insight-avatar large-avatar" aria-hidden="true">{identity!.initials}</span><div><h3>{identity!.hostname}</h3><span className="insight-host">{current.site}</span></div><span className="insight-period-tag">{period === 'today' ? 'Today' : 'Last 7 days'}</span></div>
      <div className="insight-distance-hero"><div><span className="eyebrow">SCREEN-EQUIVALENT DISTANCE</span><div className="insight-distance-number">{distanceLabel(current.distancePx).value}<span>{distanceLabel(current.distancePx).unit}</span></div></div><div className="insight-share"><span><strong>{share.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</strong> of recorded-site distance</span><div aria-hidden="true"><span style={{ width: `${share}%` }} /></div><small>Within {summaries.length === 1 ? 'this recorded website' : `these ${summaries.length} recorded websites`}, not all browsing</small></div></div>
      <dl className="insight-metrics"><div><dt><Clock3 size={14} />Active scrolling</dt><dd>{siteScrollTime(current.activeMs)}<small>{current.activeMs === 0 ? 'Distance recorded, no timed interval yet' : 'Moving the page, not time on site'}</small></dd></div><div><dt><Mouse size={14} />Burst starts</dt><dd>{current.actions.toLocaleString()}<small>{current.actions === 1 ? 'One continuous scrolling burst' : 'A new burst after a 2-second pause'}</small></dd></div><div><dt><TrendingUp size={14} />Peak hour by distance</dt><dd>{busiest && busiest.distancePx > 0 ? hourLabel(busiest.hour) : '—'}<small>Local clock at collection</small></dd></div></dl>
      <div className="insight-chart-controls"><div className="insight-view-switch" role="group" aria-label="Chart timescale"><button aria-pressed={chartView === 'hour'} onClick={() => setChartView('hour')}>By hour</button><button aria-pressed={chartView === 'day'} onClick={() => setChartView('day')}>By day</button></div><div className="insight-metric-switch" role="group" aria-label="Chart metric">{(Object.keys(metricNames) as ChartMetric[]).map((value) => <button key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{metricNames[value]}</button>)}</div></div>
      <Breakdown key={`${current.site}:${chartView}:${metric}:${period}`} rows={chartView === 'hour' ? hours : siteDays(snapshot.siteHours ?? [], current.site)} metric={metric} hourly={chartView === 'hour'} period={period} />
      <div className="insight-footer"><details className="insight-method"><summary>How these numbers work</summary><p>Distance is an estimated screen equivalent, not physical finger travel. Active scrolling excludes watching videos and idle time. Single scroll events can record distance without a timed interval, so zero seconds does not mean no movement.</p><p>Hours use the local clock at collection. In a seven-day view, each hour combines that hour across the days. Repeated DST hours merge; older records are not moved after timezone changes. A continuous burst starts once and active time is split at hour boundaries. By day always shows the last seven days, even when Today is selected.</p></details><div className="insight-delete">{deleteSite === current.site ? <div className="insight-control-actions" role="group" aria-label="Confirm website history deletion"><p>Delete all retained details for {identity!.hostname}? Combined totals stay unchanged. New scrolling can be recorded again.</p><button className="button ghost" disabled={disabled} onClick={() => setDeleteSite('')}>Cancel website deletion</button><button className="button danger" disabled={disabled} onClick={() => { void run(async () => { await send({ type: 'DELETE_SITE_INSIGHTS', site: current.site }); setDeleteSite(''); }, 'Website history deleted. Anonymous totals are unchanged; new scrolling can be recorded.'); }}>Delete this website’s history</button></div> : <button className="insight-delete-button" disabled={disabled} onClick={() => setDeleteSite(current.site)}><Trash2 size={13} />Delete website history</button>}</div></div>
      </div></div>
    </>}
  </section>;
}