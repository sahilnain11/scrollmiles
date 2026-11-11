import { useState } from 'react';
import { ArrowUpRight, BarChart3, Globe2, ShieldCheck, Trash2 } from 'lucide-react';
import { distanceLabel, durationLabel } from '../analytics/metrics';
import { hourLabel, siteDays, siteHoursForPeriod, siteSummaries } from '../analytics/sites';
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

function Breakdown({ title, rows, label }: { title: string; rows: DayStats[]; label(row: DayStats, index: number): string }) {
  const maximum = Math.max(1, ...rows.map((row) => row.distancePx));
  return <section className="insight-breakdown" aria-label={title}>
    <h3>{title}</h3>
    <div className="insight-bars" role="img" aria-label={`${title}: scroll distance. Exact pixel, time, and burst values are in the table below.`}>
      {rows.map((row, index) => <div className="insight-column" key={index}><div className="insight-bar-space"><div className="insight-bar" style={{ height: `${row.distancePx / maximum * 100}%` }} /></div><span>{rows.length === 24 ? index % 4 === 0 ? String(index).padStart(2, '0') : '' : label(row, index).slice(5)}</span></div>)}
    </div>
    <details className="insight-table"><summary>View {title.toLowerCase()} values</summary><div className="insight-table-scroll"><table><caption className="sr-only">{title} — exact scrolling totals</caption><thead><tr><th scope="col">{rows.length === 24 ? 'Local hour' : 'Date'}</th><th scope="col">CSS pixels</th><th scope="col">Burst starts</th><th scope="col">Active scrolling</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><th scope="row">{label(row, index)}</th><td>{Math.round(row.distancePx).toLocaleString()}</td><td>{row.actions.toLocaleString()}</td><td>{durationLabel(row.activeMs)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function SiteInsights({ snapshot, disabled, run, period }: Props & { period: 'today' | 'week' }) {
  const [selected, setSelected] = useState('');
  const [deleteSite, setDeleteSite] = useState('');
  const summaries = siteSummaries(snapshot.siteHours ?? [], period);
  const current = summaries.find((site) => site.site === selected) ?? summaries[0];
  const hours = current ? siteHoursForPeriod(snapshot.siteHours ?? [], current.site, period) : [];
  const busiest = hours.reduce<(typeof hours)[number] | undefined>((top, hour) => !top || hour.distancePx > top.distancePx ? hour : top, undefined);
  return <section id="website-insights" className="panel site-insights" aria-labelledby="website-insights-heading">
    <div className="section-heading"><div><div className="eyebrow"><Globe2 size={14} /> A CLOSER LOOK</div><h2 id="website-insights-heading">Your scrolling, site by site</h2></div><span className="subtle-label">{period === 'today' ? 'Today' : 'Last 7 days'}</span></div>
    {!snapshot.settings.siteInsightsEnabled ? <div className="insights-empty"><BarChart3 size={25} /><h3>Anonymous until you choose otherwise.</h3><p>Website insights are off. Enable them to save website/hour totals locally for new activity. Your existing combined history cannot be split retrospectively.</p><a className="button ghost" href="options.html">Choose in privacy settings<ArrowUpRight size={14} /></a></div> : !current ? <div className="insights-empty"><BarChart3 size={25} /><h3>No website activity for this period yet.</h3><p>Scroll on an enabled, visible website to start. Watching a video without scrolling adds no active scrolling time. Paused, excluded, earlier anonymous, or deleted site activity will not appear here.</p><a href="options.html" className="text-link">Manage tracking and privacy<ArrowUpRight size={14} /></a></div> : <>
      <p className="insights-description">Only activity recorded with website insights on. “Active scrolling” is not total time on a website, video watching, or proof of attention.</p>
      <div className="insights-layout"><nav className="insight-site-list" aria-label="Choose a website to analyze">{summaries.map((site) => <button key={site.site} className={site.site === current.site ? 'insight-site selected-site' : 'insight-site'} aria-pressed={site.site === current.site} disabled={disabled} onClick={() => { setSelected(site.site); setDeleteSite(''); }}><span>{site.site}</span><strong>{formattedDistance(site.distancePx)}</strong><small>{durationLabel(site.activeMs)} scrolling · {site.actions} burst starts</small></button>)}</nav>
      <div className="insight-detail"><h3 className="insight-host">{current.site}</h3><dl className="insight-metrics"><div><dt>Screen-equivalent distance</dt><dd>{formattedDistance(current.distancePx)}</dd></div><div><dt>Active scrolling</dt><dd>{durationLabel(current.activeMs)}</dd></div><div><dt>Burst starts</dt><dd>{current.actions.toLocaleString()}</dd></div><div><dt>Most distance in an hour</dt><dd>{busiest && busiest.distancePx > 0 ? hourLabel(busiest.hour) : '—'}</dd></div></dl>
      <Breakdown title="Hourly rhythm" rows={hours} label={(_row, index) => hourLabel(index)} />
      <Breakdown title="Seven-day trend" rows={siteDays(snapshot.siteHours ?? [], current.site)} label={(row) => row.date} />
      <p className="insight-method">Hours use the local clock at collection. In a seven-day view, each hour combines that hour across the days. Repeated DST hours merge; older records are not moved after timezone changes. A continuous burst can span hours: its start is counted once, and active time is split at the boundary. The seven-day trend always shows seven days, regardless of the period above.</p>
      <div className="insight-delete">{deleteSite === current.site ? <div className="insight-control-actions" role="group" aria-label="Confirm website history deletion"><p>Delete all retained details for this website? Combined totals stay unchanged. New scrolling can be recorded again.</p><button className="button ghost" disabled={disabled} onClick={() => setDeleteSite('')}>Cancel website deletion</button><button className="button danger" disabled={disabled} onClick={() => { void run(async () => { await send({ type: 'DELETE_SITE_INSIGHTS', site: current.site }); setDeleteSite(''); }, 'Website history deleted. Anonymous totals are unchanged; new scrolling can be recorded.'); }}>Delete this website’s history</button></div> : <button className="button ghost" disabled={disabled} onClick={() => setDeleteSite(current.site)}><Trash2 size={14} />Delete website history</button>}</div>
      </div></div>
    </>}
  </section>;
}