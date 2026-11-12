import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, CircleHelp, Compass, Footprints, Globe2, LockKeyhole, Mouse, Pause, Play, Sparkles, Timer } from 'lucide-react';
import { dayLabel, distanceLabel } from '../analytics/metrics';
import { siteScrollTime } from '../analytics/sites';
import { send } from '../utils/client';
import type { DayStats, Snapshot } from '../types';

interface Props {
  snapshot: Snapshot;
  totals: DayStats;
  week: DayStats[];
  period: 'today' | 'week';
  onPeriodChange(period: 'today' | 'week'): void;
  disabled: boolean;
  statusUnverified: boolean;
  siteForm: ReactNode;
  run(work: () => Promise<unknown>, notice?: string): Promise<void>;
  onPreview(): void;
  children: ReactNode;
}

function OverviewTrail() {
  return <svg className="overview-trail" viewBox="0 0 360 200" fill="none" aria-hidden="true"><path d="M12 180L98 64L154 118L236 18L348 159L240 197Z" fill="currentColor" opacity=".04" /><path d="M12 180L98 64L154 118L236 18L348 159" stroke="currentColor" opacity=".18" /><path d="M51 177C75 142 122 182 151 133C176 90 207 147 226 91C234 68 238 41 236 21" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 8" strokeLinecap="round" /><circle cx="51" cy="177" r="5" fill="currentColor" /><circle cx="236" cy="21" r="13" fill="currentColor" opacity=".1" /><circle cx="236" cy="21" r="5" fill="currentColor" /></svg>;
}

function WeekChart({ days }: { days: DayStats[] }) {
  const maximum = Math.max(0, ...days.map((day) => day.distancePx));
  const [selected, setSelected] = useState(6);
  const active = days[selected]!;
  const format = (px: number) => { const distance = distanceLabel(px); return `${distance.value} ${distance.unit}`; };
  return <section className="panel overview-week" aria-labelledby="overview-week-heading">
    <div className="section-heading"><div><div className="eyebrow">SEVEN DAYS. YOUR OWN PACE.</div><h2 id="overview-week-heading">Your week in motion</h2></div><span className="overview-chart-scale">{maximum > 0 ? format(maximum) : 'No activity'}<small>chart maximum</small></span></div>
    <p className="overview-week-scope">Last 7 local calendar days · screen-equivalent distance</p>
    <div className="overview-week-plot" role="group" aria-label="Daily scrolling distance"><div className="overview-week-guides" aria-hidden="true"><span /><span /><span /></div>{days.map((day, index) => <div className="overview-day" key={day.date}><button className={`overview-day-bar${selected === index ? ' selected-day' : ''}`} aria-label={`${day.date}: ${format(day.distancePx)} estimated distance`} aria-pressed={selected === index} onClick={() => setSelected(index)} onFocus={() => setSelected(index)} onMouseEnter={() => setSelected(index)}><span style={{ height: `${maximum > 0 ? day.distancePx / maximum * 100 : 0}%` }} /></button><span>{index === 6 ? 'Today' : dayLabel(day.date)}</span></div>)}{maximum === 0 && <p className="overview-chart-empty">Your journey starts with a scroll.</p>}</div>
    <div className="overview-week-readout"><span>{active.date}</span><strong>{format(active.distancePx)}</strong><span>{active.actions.toLocaleString()} bursts · {siteScrollTime(active.activeMs)} scrolling</span></div>
    <details className="chart-data"><summary>View exact daily totals</summary><div className="overview-table-scroll"><table><caption className="sr-only">Seven-day scrolling statistics</caption><thead><tr><th scope="col">Date</th><th scope="col">CSS pixels</th><th scope="col">Bursts</th><th scope="col">Active scrolling</th></tr></thead><tbody>{days.map((day) => <tr key={day.date}><th scope="row">{day.date}</th><td>{Math.round(day.distancePx).toLocaleString()}</td><td>{day.actions.toLocaleString()}</td><td>{siteScrollTime(day.activeMs)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function DashboardOverview({ snapshot, totals, week, period, onPeriodChange, disabled, statusUnverified, siteForm, run, onPreview, children }: Props) {
  const { settings } = snapshot;
  const hasSites = settings.allSitesEnabled || settings.approvedSites.length > 0;
  const active = hasSites && settings.trackingEnabled && !statusUnverified;
  const status = statusUnverified ? 'Status unavailable' : !hasSites ? 'Choose website access' : settings.trackingEnabled ? 'Tracking enabled' : 'Tracking paused';
  const distance = distanceLabel(totals.distancePx);
  const coverage = settings.allSitesEnabled
    ? `All supported sites · ${settings.excludedSites.length} exact-host exclusion${settings.excludedSites.length === 1 ? '' : 's'}`
    : `${settings.approvedSites.length} selected website${settings.approvedSites.length === 1 ? '' : 's'}`;
  return <div className="dashboard-overview">
    <div id="overview" className="dashboard-heading"><div><div className="eyebrow"><Compass size={14} />YOUR DIGITAL LIFE, MEASURED.</div><h1>{period === 'today' ? 'Your day, in scrolling.' : 'Your week, in scrolling.'}</h1><p>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · A little perspective. No screen-time guilt.</p></div><nav className="overview-jump-links" aria-label="Dashboard sections"><a href="#website-insights"><BarChart3 size={14} />Website insights</a><a href="#wrapped"><Sparkles size={14} />Wrapped</a></nav></div>
    <div className="dashboard-toolbar"><div className="period-switch" role="group" aria-label="Statistics period"><button className={period === 'today' ? 'selected' : ''} aria-pressed={period === 'today'} onClick={() => onPeriodChange('today')}>Today</button><button className={period === 'week' ? 'selected' : ''} aria-pressed={period === 'week'} onClick={() => onPeriodChange('week')}>Last 7 days</button></div><span className="overview-period-note">{period === 'today' ? 'Today’s local totals' : 'Rolling seven-day totals'} · updated from this device</span></div>
    <div className="overview-top-grid"><section className="panel overview-distance" aria-label="Distance summary"><div className="eyebrow"><Footprints size={15} />SCROLL DISTANCE</div><div className="overview-distance-value"><strong>{distance.value}</strong><span>{distance.unit}</span></div><p>{totals.distancePx > 0 ? 'Small movements. Quite a journey.' : 'Every journey starts somewhere.'}</p><div className="overview-estimate"><CircleHelp size={13} />Estimated screen-equivalent distance</div><OverviewTrail /></section>
    <aside className="panel overview-collection" aria-labelledby="collection-heading"><div className="eyebrow"><LockKeyhole size={13} />YOUR DATA. YOUR RULES.</div><h2 id="collection-heading"><span className={active ? 'overview-status-dot on' : 'overview-status-dot'} />{status}</h2><p>{statusUnverified ? 'The last read failed. Retry loading before changing tracking or creating a new preview.' : hasSites ? coverage : 'Nothing is tracked until you choose a website and grant Chrome access.'}</p>{hasSites ? <button className="button ghost overview-pause" disabled={disabled || statusUnverified} aria-label={`${status}. ${settings.trackingEnabled ? 'Pause tracking' : 'Resume tracking'}`} onClick={() => { void run(() => send({ type: 'SET_TRACKING', enabled: !settings.trackingEnabled }), settings.trackingEnabled ? 'Tracking paused on every enabled website.' : 'Tracking resumed on enabled websites.'); }}>{settings.trackingEnabled ? <Pause size={14} /> : <Play size={14} />}{settings.trackingEnabled ? 'Pause tracking' : 'Resume tracking'}</button> : <a className="button ghost" href="options.html"><Globe2 size={14} />Choose website access</a>}<a className="overview-settings-link" href="options.html">Privacy & settings<ArrowUpRight size={13} /></a><span className="overview-status-note">Global setting, not proof this tab is being tracked.</span></aside></div>
    <div className="overview-metrics"><section className="panel metric-card"><Timer className="overview-metric-icon" size={17} /><span className="metric-title">Active scrolling</span><strong>{siteScrollTime(totals.activeMs)}</strong><span className="metric-description">{totals.distancePx > 0 && totals.activeMs === 0 ? 'Movement recorded; no timed interval yet' : 'Not total browser time or video watching'}</span></section><section className="panel metric-card"><Mouse className="overview-metric-icon" size={17} /><span className="metric-title">Scroll bursts</span><strong>{totals.actions.toLocaleString()}</strong><span className="metric-description">A new burst after a two-second pause</span></section><section className="panel metric-card"><ArrowDown className="overview-metric-icon" size={17} /><span className="metric-title">The raw distance</span><strong>{Math.round(totals.distancePx).toLocaleString()}<small>px</small></strong><span className="metric-description">CSS pixels · down + up, both counted</span></section></div>
    <div className="overview-secondary-grid"><WeekChart days={week} /><section id="wrapped" className="panel overview-wrapped" aria-labelledby="overview-wrapped-heading"><span className="overview-wrapped-mark"><Sparkles size={22} /></span><div className="eyebrow">A SMALL STAT. A CONVERSATION STARTER.</div><h2 id="overview-wrapped-heading">Your scroll story.<br /><span>Ready when you are.</span></h2><p>Preview your actual card before saving. Only the combined totals you choose—never website names or browsing history.</p><div className="overview-export-facts"><span><LockKeyhole size={12} />Local & site-free</span><span>PNG · 1200 × 1200</span></div><button className="button primary" disabled={disabled || statusUnverified} onClick={onPreview}>Preview my Wrapped<ArrowUpRight size={15} /></button><small>No download or post until you choose.</small></section></div>
    <section className="panel overview-access"><div className="section-heading"><div><h2>{hasSites ? 'Your corner of the internet' : 'Choose where your journey begins'}</h2><p>{hasSites ? `${coverage}. Manage permission changes and sensitive-site exclusions in settings.` : 'Enable an exact hostname, or review optional all-site access in settings.'}</p></div><a className="button ghost" href="options.html">Manage websites<ArrowUpRight size={14} /></a></div>{!hasSites && <>{siteForm}<p className="overview-access-note">Chrome asks for access. Use www.youtube.com for YouTube video pages. Avoid sensitive websites.</p></>}</section>
    {children}
    <details className="overview-method"><summary><CircleHelp size={14} />How ScrollMiles measures your journey</summary><p>CSS pixels are the source of truth. Metres/kilometres use 96 CSS px per inch and are estimates, not actual finger travel or exercise. Automatic page scrolling can be included.</p><p>Active scrolling sums event-to-event intervals within bursts, not total time online. An isolated event can add distance without timed seconds. Website insights starts only after separate opt-in; its totals need not match earlier anonymous history.</p><a href="privacy.html">Read the privacy notice<ArrowRight size={13} /></a></details>
  </div>;
}