import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleHelp, Compass, Footprints, Globe2, LockKeyhole, Moon, Mouse, Pause, Play, Plus, Settings2, ShieldCheck, Sparkles, Sun, Timer, Trash2, X } from 'lucide-react';
import { Brand } from './Brand';
import { AllSitesControl } from './AllSitesControl';
import { SiteInsights, SiteInsightsControl } from './SiteInsights';
import { dayLabel, distanceLabel, durationLabel, emptyDay, lastSevenDays, localDate, sumDays } from '../analytics/metrics';
import { send } from '../utils/client';
import { normalizeSite, sitePattern } from '../utils/sites';
import { exportCard } from '../wrapped/CardRenderer';
import type { DayStats, Snapshot } from '../types';

type Page = 'popup' | 'dashboard' | 'options';
const EMPTY: Snapshot = { settings: { trackingEnabled: false, approvedSites: [], allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null, epoch: '', theme: 'dark' }, days: [] };

function JourneyArt() {
  return <svg className="journey-art" viewBox="0 0 480 300" fill="none" aria-hidden="true">
    <defs><linearGradient id="land" x1="240" y1="70" x2="240" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="#b4d788" stopOpacity=".23" /><stop offset="1" stopColor="#b4d788" stopOpacity="0" /></linearGradient></defs>
    {[0, 1, 2, 3, 4, 5].map((i) => <ellipse key={i} cx="250" cy={170 + i * 10} rx={165 - i * 19} ry={70 - i * 5} stroke="currentColor" opacity={0.05 + i * 0.025} transform="rotate(-15 250 170)" />)}
    <path d="M65 220L167 110L230 174L305 72L422 192L300 263L161 268Z" fill="url(#land)" />
    <path d="M65 220L167 110L230 174L305 72L422 192" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.5" />
    <path d="M110 239C135 210 198 235 220 202C248 161 284 191 309 158C327 135 319 109 311 87" stroke="#c5ef8a" strokeWidth="3" strokeDasharray="5 8" strokeLinecap="round" />
    <circle cx="110" cy="239" r="6" fill="#c5ef8a" /><circle cx="309" cy="80" r="15" fill="#c5ef8a" fillOpacity=".12" /><circle cx="309" cy="80" r="6" fill="#c5ef8a" />
    <path d="M304 56V28L325 35L304 43" stroke="#c5ef8a" strokeWidth="2" strokeLinejoin="round" />
    <path d="M167 110L168 145M305 72L300 110" stroke="currentColor" opacity=".1" />
    <circle cx="98" cy="83" r="3" fill="currentColor" opacity=".3" /><path d="M382 77V89M376 83H388" stroke="currentColor" opacity=".25" />
  </svg>;
}

function Distance({ stats, compact = false }: { stats: DayStats; compact?: boolean }) {
  const distance = distanceLabel(stats.distancePx);
  return <div className={compact ? 'distance compact-distance' : 'distance'}><span>{distance.value}</span><span className="distance-unit">{distance.unit}</span></div>;
}

function WeekChart({ days }: { days: DayStats[] }) {
  const maximum = Math.max(...days.map((day) => day.distancePx), 1);
  const hasData = days.some((day) => day.distancePx > 0);
  return <div className="chart-wrap">
    <div className="chart" role="img" aria-label={hasData ? 'Daily scroll distance over the last seven days. Exact values are in the table below.' : 'No scrolling recorded in the last seven days.'}>
      <div className="chart-guides"><span /><span /><span /></div>
      {days.map((day, index) => <div className="chart-column" key={day.date}>
        <div className="bar-space"><div className={`chart-bar ${index === 6 ? 'today-bar' : ''}`} style={{ height: `${hasData ? Math.max(day.distancePx > 0 ? 4 : 0, day.distancePx / maximum * 100) : 0}%` }}><span className="bar-tooltip">{distanceLabel(day.distancePx).value} {distanceLabel(day.distancePx).unit}</span></div></div>
        <span className={index === 6 ? 'chart-day current' : 'chart-day'}>{index === 6 ? 'Today' : dayLabel(day.date)}</span>
      </div>)}
      {!hasData && <div className="chart-empty"><span className="empty-dot" />Your journey starts with a scroll.</div>}
    </div>
    <details className="chart-data"><summary>View exact daily totals</summary><table><caption className="sr-only">Seven-day scrolling statistics</caption><thead><tr><th>Date</th><th>CSS pixels</th><th>Bursts</th><th>Active time</th></tr></thead><tbody>{days.map((day) => <tr key={day.date}><th scope="row">{day.date}</th><td>{Math.round(day.distancePx).toLocaleString()}</td><td>{day.actions}</td><td>{durationLabel(day.activeMs)}</td></tr>)}</tbody></table></details>
  </div>;
}

export function App({ page }: { page: Page }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [initializing, setLoading] = useState(true);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [siteInput, setSiteInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const { settings } = snapshot;
  const week = lastSevenDays(snapshot.days);
  const today = week.at(-1) ?? emptyDay(localDate());
  const totals = period === 'week' ? sumDays(week) : today;
  const loading = initializing || !hasSnapshot;
  const isPopup = page === 'popup';
  const hasSites = settings.allSitesEnabled || settings.approvedSites.length > 0;
  const active = settings.trackingEnabled && hasSites;
  const trackingStatus = !settings.trackingEnabled ? 'Paused' : !hasSites ? 'Ready to explore' : 'Tracking enabled';

  const refresh = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) throw new Error('Open this page from the installed ScrollMiles extension to start tracking.');
    const data = await send<Snapshot>({ type: 'GET_SNAPSHOT' });
    setSnapshot(data);
    setHasSnapshot(true);
    setLoadError('');
    document.documentElement.dataset.theme = data.settings.theme;
  }, []);

  useEffect(() => {
    const reportLoadError = (reason: unknown) => setLoadError(reason instanceof Error ? reason.message : 'Could not load your stats.');
    void refresh().catch(reportLoadError).finally(() => setLoading(false));
    // UI-only refresh; there is no background polling or always-running worker timer.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(reportLoadError);
    }, 2_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function act(work: () => Promise<unknown>, message = ''): Promise<void> {
    setBusy(true); setError(''); setNotice('');
    try { await work(); await refresh(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  function grantSite(event: React.FormEvent): void {
    event.preventDefault();
    if (busy || loading) return;
    let site: string;
    try { site = normalizeSite(siteInput.trim()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Enter a valid website.'); return; }
    if (settings.allSitesEnabled) {
      void act(async () => { await send({ type: 'EXCLUDE_SITE', site }); setSiteInput(''); }, 'Website excluded from collection. Chrome’s broad host permission remains granted.');
      return;
    }
    // Call directly from the click/submit gesture, before any asynchronous work.
    let permission: Promise<boolean>;
    try { permission = chrome.permissions.request({ origins: [sitePattern(site)] }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chrome could not request website access.'); return; }
    void act(async () => {
      if (!await permission) throw new Error('Permission was not granted. Nothing will be tracked on that website.');
      await send({ type: 'ADD_SITE', site });
      setSiteInput('');
    }, 'Website enabled. Scroll there to start your journey.');
  }

  const siteForm = <form className="site-form" onSubmit={grantSite}><label className="sr-only" htmlFor="website">{settings.allSitesEnabled ? 'Website to exclude' : 'Website to enable'}</label><div className="input-wrap"><Globe2 size={16} /><input id="website" type="text" placeholder="example.com" autoComplete="off" spellCheck={false} value={siteInput} onChange={(event) => setSiteInput(event.target.value)} required maxLength={300} disabled={busy || loading} /></div><button className="button primary icon-button" type="submit" disabled={busy || loading || !siteInput.trim()} aria-label={settings.allSitesEnabled ? 'Exclude website' : 'Enable website'}><Plus size={19} /></button></form>;

  const share = () => { void act(() => exportCard(totals, period === 'week'), 'Your share card has been downloaded.'); };

  return <div className={isPopup ? 'app popup' : 'app'}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="header"><Brand />{!isPopup && <nav className="main-nav" aria-label="Main navigation"><a href="dashboard.html" className={page === 'dashboard' ? 'nav-active' : ''}>Overview</a><a href="options.html" className={page === 'options' ? 'nav-active' : ''}>Privacy & settings</a></nav>}<div className="header-actions">{!isPopup && <span className="local-chip"><LockKeyhole size={12} /> On-device only</span>}<button className="icon-button theme-button" aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} disabled={busy || loading} onClick={() => { void act(() => send({ type: 'SET_THEME', theme: settings.theme === 'dark' ? 'light' : 'dark' })); }}>{settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>

    <main id="main-content" tabIndex={-1}>
      {loadError && <div className="load-feedback" role="alert"><p><strong>{hasSnapshot ? 'These totals may be out of date.' : 'Your statistics could not be loaded.'}</strong>{loadError} Tracking status could not be verified.</p><button className="button ghost" disabled={initializing} onClick={() => {
        setLoading(true);
        void refresh().catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : 'Could not load your stats.')).finally(() => setLoading(false));
      }}>Retry loading</button></div>}
      {error && <div className="message error" role="alert"><CircleHelp size={17} /><span>{error}</span><button aria-label="Dismiss error" className="icon-button" onClick={() => setError('')}><X size={15} /></button></div>}
      {initializing && <div className="sr-only" role="status">Loading your local statistics.</div>}
      {notice && <div className="message success" role="status"><Check size={16} />{notice}</div>}

      {!hasSnapshot ? <section className="panel unavailable-panel"><h1>{initializing ? 'Opening your local journey…' : 'Your data deserves a proper read.'}</h1><p>{initializing ? 'Reading the statistics stored on this device.' : 'An unavailable database is not the same as zero activity. Retry loading before viewing totals or changing tracking.'}</p><a className="button ghost" href="privacy.html" target={isPopup ? '_blank' : undefined} rel="noreferrer">Read the privacy notice<ArrowUpRight size={14} /></a></section> : page === 'options' ? <>
        <div className="page-heading"><div className="eyebrow"><ShieldCheck size={14} /> YOUR DATA. YOUR RULES.</div><h1>A little tracking.<br /><span>A lot of privacy.</span></h1><p>Only the websites you choose. Only on this device.</p></div>
        <AllSitesControl supported={snapshot.capabilities?.allSiteAccess === true} enabled={settings.allSitesEnabled} disabled={busy || loading} run={act} />
        <SiteInsightsControl snapshot={snapshot} disabled={busy || loading} run={act} />
        <div className="settings-layout"><section className="panel settings-panel"><div className="section-heading"><h2>Tracking controls</h2><Settings2 size={18} /></div><div className="setting-row"><div><h3>Scroll tracking</h3><p>Pause collection everywhere, instantly.</p></div><button className={`toggle ${settings.trackingEnabled ? 'on' : ''}`} role="switch" aria-checked={settings.trackingEnabled} aria-label="Scroll tracking" disabled={busy || loading} onClick={() => { void act(() => send({ type: 'SET_TRACKING', enabled: !settings.trackingEnabled })); }}><span /></button></div><div className="divider" /><h3>{settings.allSitesEnabled ? 'Excluded websites' : 'Your enabled websites'} <span className="count">{settings.allSitesEnabled ? settings.excludedSites.length : settings.approvedSites.length}</span></h3><p className="muted small">{settings.allSitesEnabled ? 'Excluded hosts are not collected. Exclusions are ScrollMiles controls, not revocation of Chrome’s broad host permission.' : 'Exact hostnames only. Subdomains and HTTP/HTTPS are separate. Access covers all paths and ports on each enabled host.'}</p><p className="muted small">For YouTube video pages, use www.youtube.com. All paths, including /watch and comments, are covered.</p>{siteForm}<div className="site-list">{(settings.allSitesEnabled ? settings.excludedSites : settings.approvedSites).length ? (settings.allSitesEnabled ? settings.excludedSites : settings.approvedSites).map((site) => <div className="site-row" key={site}><Globe2 size={16} /><span>{site}</span><button className="icon-button remove-site" aria-label={settings.allSitesEnabled ? `Stop excluding ${site}` : `Remove ${site}`} disabled={busy} onClick={() => { void act(() => send({ type: settings.allSitesEnabled ? 'INCLUDE_SITE' : 'REMOVE_SITE', site }), settings.allSitesEnabled ? 'Exclusion removed. This website can be collected again.' : 'Website removed and its permission revoked.'); }}><X size={16} /></button></div>) : <div className="empty-sites">{settings.allSitesEnabled ? 'No exclusions. All supported websites are included when tracking is not paused.' : 'No websites enabled. Nothing is being tracked.'}</div>}</div><p className="privacy-hint"><LockKeyhole size={13} />{settings.allSitesEnabled ? 'Exclude banking, health, work, and other sensitive websites. Exclude each exact subdomain separately.' : 'Keep banking, health, work, and other sensitive websites off this list.'}</p></section>
        <aside className="panel privacy-panel"><span className="large-icon"><ShieldCheck size={28} /></span><h2>Private isn’t an upgrade.</h2><p>It’s how ScrollMiles works.</p><ul className="privacy-list">{['No accounts or cloud uploads', 'No page text, searches, or keystrokes', 'No saved full URLs or browsing history', 'No advertising or third-party analytics', 'No incognito tracking'].map((text) => <li key={text}><Check size={15} />{text}</li>)}</ul><div className="privacy-receipt"><span>Stored on this device</span><strong>Daily totals + enabled hostnames</strong><span>Automatic history retention</span><strong>90 calendar days</strong></div><a className="text-link privacy-policy-link" href="privacy.html">Read the full privacy notice<ArrowUpRight size={14} /></a></aside></div>
        <section className="panel danger-panel"><div><h2>A clean slate</h2><p>Delete all recorded totals and pause tracking. Website choices and theme stay saved. There is no undo.</p></div>{confirmDelete ? <div className="delete-confirm" role="group" aria-label="Confirm deletion"><button className="button ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button className="button danger" disabled={busy} onClick={() => { void act(async () => { await send({ type: 'CLEAR_DATA' }); setConfirmDelete(false); }, 'All history deleted. Tracking is paused.'); }}>Delete & pause</button></div> : <button className="button danger" disabled={busy || loading} onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete history</button>}</section>
      </> : <>
        <div className="overview-heading"><div><div className="eyebrow"><span className="tiny-line" /> YOUR DIGITAL LIFE, MEASURED.</div><h1>{isPopup ? <>Little scrolls.<br /><span>Big journeys.</span></> : <>Your thumb’s<br /><span>been places.</span><span className="heading-star">✳</span></>}</h1><p>{isPopup ? 'A fresh perspective on your everyday browsing.' : 'Every little scroll adds up. Here’s your side of the story.'}</p></div>{!isPopup && <div className="heading-note"><span className="handdrawn-arrow">↙</span><span>Less judgment.<br />More curiosity.</span></div>}</div>
        <div className="overview-toolbar"><div className="period-switch" role="group" aria-label="Statistics period"><button className={period === 'today' ? 'selected' : ''} aria-pressed={period === 'today'} onClick={() => setPeriod('today')}>Today</button><button className={period === 'week' ? 'selected' : ''} aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Last 7 days</button></div><button className={`tracking-pill ${active ? 'is-active' : ''}`} disabled={busy || loading} onClick={() => { void act(() => send({ type: 'SET_TRACKING', enabled: !settings.trackingEnabled })); }} aria-label={`${trackingStatus}. ${settings.trackingEnabled ? 'Pause tracking' : 'Resume tracking'}`}><span className="status-dot" />{trackingStatus}{settings.trackingEnabled ? <Pause size={12} /> : <Play size={12} />}</button></div>
        <section className="journey-panel panel"><div className="journey-stats"><div className="eyebrow"><Footprints size={15} /> SCROLL DISTANCE</div><Distance stats={totals} /><p className="distance-caption">{totals.distancePx > 0 ? 'Tiny movements. A surprisingly long way.' : 'Every journey starts somewhere.'}</p><div className="estimate-label"><CircleHelp size={12} />Estimated screen-equivalent distance</div></div><JourneyArt /><span className="journey-coordinate">{period === 'today' ? new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'LAST 7 DAYS'} <span>·</span> YOUR OWN PACE</span></section>
        <div className="metric-grid"><section className="panel metric-card"><span className="metric-icon"><Mouse size={18} /></span><span className="metric-title">Scroll bursts</span><strong>{totals.actions.toLocaleString()}</strong><span className="metric-description">Little moments of movement</span></section><section className="panel metric-card"><span className="metric-icon"><Timer size={18} /></span><span className="metric-title">Active scrolling</span><strong>{durationLabel(totals.activeMs)}</strong><span className="metric-description">Not your total browser time</span></section>{!isPopup && <section className="panel metric-card"><span className="metric-icon"><ArrowDown size={18} /></span><span className="metric-title">The raw distance</span><strong>{Math.round(totals.distancePx).toLocaleString()}<small>px</small></strong><span className="metric-description">CSS pixels. Down + up, all counted.</span></section>}</div>
        {!isPopup && <div className="detail-grid"><section className="panel week-panel"><div className="section-heading"><div><div className="eyebrow">A LITTLE PERSPECTIVE</div><h2>Your week in motion</h2></div><span className="subtle-label">Last 7 days</span></div><WeekChart days={week} /><div className="chart-footer"><span><span className="legend-dot" />Scroll distance</span><span>No competition. Just your rhythm.</span></div></section><section className="share-panel"><div className="eyebrow"><Sparkles size={14} /> MADE TO SHARE</div><h2>Your scroll story.<br />Off the screen.</h2><p>A little stat. A conversation starter.<br />Zero browsing history attached.</p><div className="mini-card"><span>↟ ScrollMiles</span><Distance stats={totals} compact /><span>{period === 'today' ? 'MY DAY, IN SCROLLING' : 'MY WEEK, IN SCROLLING'}</span><span className="mini-card-sticker"><ArrowUpRight size={27} /></span></div><button className="button share-button" disabled={busy || loading} onClick={share}><ArrowDownToLine size={16} />Download my Wrapped<ArrowUpRight size={16} /></button><span className="share-note">PNG · 1200 × 1200 · Made on your device</span></section></div>}
        <section className="panel sites-panel"><div className="sites-intro"><span className="sites-icon"><Globe2 size={22} /></span><div><h2>{hasSites ? 'Your corner of the internet' : 'Choose where your journey begins'}</h2><p>{settings.allSitesEnabled ? `All supported websites. ${settings.excludedSites.length} exact-host exclusion${settings.excludedSites.length === 1 ? '' : 's'}.` : settings.approvedSites.length ? `${settings.approvedSites.length} website${settings.approvedSites.length === 1 ? '' : 's'} enabled. Everywhere else stays off.` : 'Nothing is tracked until you enable a website.'}</p></div>{!isPopup && hasSites && <a className="text-link" href="options.html">Manage websites<ChevronRight size={15} /></a>}</div>{siteForm}<p className="permission-note">{settings.allSitesEnabled ? 'Add an exact-host exclusion here, or manage access in settings.' : 'Chrome will ask for website access. Only the exact hostname is enabled; avoid sensitive sites.'}</p><a className="text-link privacy-policy-link" href="options.html" target={isPopup ? '_blank' : undefined} rel="noreferrer">{settings.allSitesEnabled ? 'Manage all-site access' : 'Prefer one permission? All-site setup'}<ChevronRight size={14} /></a></section>
        {isPopup && <div className="popup-links"><a className="button primary" href="dashboard.html" target="_blank" rel="noreferrer">Your full story<ArrowUpRight size={16} /></a><button className="button ghost" disabled={busy || loading} onClick={share} aria-label="Download Wrapped card"><ArrowDownToLine size={17} /></button><a className="button ghost" href="options.html" target="_blank" rel="noreferrer" aria-label="Privacy and settings"><Settings2 size={17} /></a></div>}
        {!isPopup && <SiteInsights snapshot={snapshot} disabled={busy || loading} run={act} period={period} />}
        {!isPopup && <div className="method-note"><Compass size={17} /><p><strong>A note on the numbers.</strong> Distance uses CSS pixels at 96 px/inch, not physical finger travel. A burst ends after 2 seconds without scrolling. Active time sums gaps within bursts, not time between them. Automatic page scrolling can be included.</p><a href="options.html" aria-label="Read privacy and tracking settings"><ArrowRight size={18} /></a></div>}
      </>}
    </main>
    <footer><span><span className="footer-dot" />{isPopup ? 'Local-first. Always.' : 'Made for curiosity, not screen-time guilt.'}</span><a href="privacy.html" target={isPopup ? '_blank' : undefined} rel="noreferrer">Privacy notice</a>{!isPopup && <span><ShieldCheck size={13} />Your data never leaves this device.</span>}</footer>
  </div>;
}