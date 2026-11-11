import type { ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpRight, BarChart3, ChevronRight, CircleHelp, Footprints, Globe2, Mouse, Pause, Play, ShieldCheck, Timer } from 'lucide-react';
import { daysAgo, distanceLabel } from '../analytics/metrics';
import { siteScrollTime } from '../analytics/sites';
import { send } from '../utils/client';
import type { DayStats, Snapshot } from '../types';

interface Props {
  snapshot: Snapshot;
  totals: DayStats;
  period: 'today' | 'week';
  onPeriodChange(period: 'today' | 'week'): void;
  disabled: boolean;
  statusUnverified: boolean;
  siteForm: ReactNode;
  run(work: () => Promise<unknown>, notice?: string): Promise<void>;
  onExport(): void;
}

function PopupTrail() {
  return <svg className="quick-trail" viewBox="0 0 170 130" fill="none" aria-hidden="true">
    <path d="M8 116L52 50L83 79L124 20L166 91L134 126Z" fill="currentColor" opacity=".055" />
    <path d="M8 116L52 50L83 79L124 20L166 91" stroke="currentColor" opacity=".2" />
    <path d="M24 111C39 88 64 109 74 87C85 63 107 88 119 58C124 47 125 35 124 23" stroke="currentColor" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
    <circle cx="24" cy="111" r="4" fill="currentColor" /><circle cx="124" cy="23" r="10" fill="currentColor" opacity=".1" /><circle cx="124" cy="23" r="4" fill="currentColor" />
    <path d="M121 8V-2L133 2L121 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>;
}

/** A quick glance at existing aggregates, never a second collection path. */
export function PopupOverview({ snapshot, totals, period, onPeriodChange, disabled, statusUnverified, siteForm, run, onExport }: Props) {
  const { settings } = snapshot;
  const hasSites = settings.allSitesEnabled || settings.approvedSites.length > 0;
  const collecting = settings.trackingEnabled && hasSites;
  const distance = distanceLabel(totals.distancePx);
  const localDay = new Date();
  const dateLabel = period === 'today'
    ? localDay.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : `${new Date(`${daysAgo(6)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${localDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  const status = statusUnverified ? 'Status unavailable' : !hasSites
    ? settings.trackingEnabled ? 'Choose a website to begin' : 'Paused · no websites enabled'
    : collecting ? 'Tracking enabled' : 'Tracking paused';
  const coverage = settings.allSitesEnabled
    ? `All supported sites · ${settings.excludedSites.length} exact-host exclusion${settings.excludedSites.length === 1 ? '' : 's'}`
    : `${settings.approvedSites.length} selected website${settings.approvedSites.length === 1 ? '' : 's'}`;
  const hasMovement = totals.distancePx > 0;
  const firstUse = !hasSites && !hasMovement;

  return <div className={`quick-overview${firstUse ? ' quick-first-use' : ''}`}>
    <div className="quick-heading"><div><h1>{period === 'today' ? 'Your day, in scrolling.' : 'Your week, in scrolling.'}</h1><p>{dateLabel}</p></div><div className="quick-period" role="group" aria-label="Statistics period"><button aria-pressed={period === 'today'} onClick={() => onPeriodChange('today')}>Today</button><button aria-pressed={period === 'week'} onClick={() => onPeriodChange('week')}>Last 7 days</button></div></div>

    <section className="quick-journey panel" aria-label="Scrolling summary">
      <div className="quick-distance"><div className="eyebrow"><Footprints size={13} />SCROLL DISTANCE</div><div className="quick-distance-value"><strong>{distance.value}</strong><span>{distance.unit}</span></div><p>Estimated screen-equivalent distance</p><PopupTrail /></div>
      {!firstUse && <dl className="quick-metrics"><div><dt><Timer size={14} />Active scrolling</dt><dd>{siteScrollTime(totals.activeMs)}<small>{hasMovement && totals.activeMs === 0 ? 'No timed interval yet' : 'Not total browser time'}</small></dd></div><div><dt><Mouse size={14} />Scroll bursts</dt><dd>{totals.actions.toLocaleString()}<small>Not individual scroll events</small></dd></div></dl>}
    </section>

    <section className={`quick-status${collecting && !statusUnverified ? ' quick-status-on' : ''}`} aria-label="Collection status"><span className="quick-status-dot" aria-hidden="true" /><div><h2>{status}</h2><p>{statusUnverified ? 'Retry loading to verify collection.' : hasSites ? coverage : 'Nothing is collected without website access.'}</p></div>{hasSites ? <button className="quick-pause" disabled={disabled || statusUnverified} aria-label={`${status}. ${settings.trackingEnabled ? 'Pause tracking' : 'Resume tracking'}`} onClick={() => { void run(() => send({ type: 'SET_TRACKING', enabled: !settings.trackingEnabled }), settings.trackingEnabled ? 'Tracking paused on every enabled website.' : 'Tracking resumed on enabled websites.'); }}>{settings.trackingEnabled ? <Pause size={13} /> : <Play size={13} />}{settings.trackingEnabled ? 'Pause' : 'Resume'}</button> : <a className="quick-access-link" href="options.html" target="_blank" rel="noreferrer" aria-label="Choose website access in settings"><Globe2 size={16} /><ChevronRight size={13} /></a>}</section>

    {!hasSites ? <section className="quick-onboarding" aria-labelledby="quick-onboarding-heading"><h2 id="quick-onboarding-heading">Your first stop?</h2><p>Enter an exact host, such as www.youtube.com.</p>{siteForm}<p className="quick-access-note">Chrome asks for access. Avoid sensitive websites.</p><a href="options.html" target="_blank" rel="noreferrer">Prefer all-site access? Review it in settings<ArrowUpRight size={12} /></a></section> : !hasMovement && <p className="quick-zero">{period === 'today' ? 'No scrolls recorded today.' : 'No scrolls recorded in the last 7 days.'} {settings.trackingEnabled ? 'Scroll on an enabled website to start.' : 'Resume when you’re ready. Existing history is kept.'}</p>}

    {!firstUse && <a className="quick-insights" href={settings.siteInsightsEnabled ? 'dashboard.html#website-insights' : 'options.html'} target="_blank" rel="noreferrer"><span className="quick-insights-icon"><BarChart3 size={17} /></span><span><strong>Website insights <small>{settings.siteInsightsEnabled ? 'On' : 'Off'}</small></strong><span>{settings.siteInsightsEnabled ? 'Explore your sites and hourly rhythm' : 'Optional site-by-site detail. Your choice.'}</span></span><ChevronRight size={16} /></a>}

    <nav className="quick-actions" aria-label="Popup actions"><a className="button primary" href="dashboard.html" target="_blank" rel="noreferrer">Your full story<ArrowUpRight size={15} /></a><button className="button ghost quick-export" disabled={disabled || statusUnverified} onClick={onExport} aria-label={`Download Wrapped card for ${period === 'today' ? 'today' : 'the last 7 days'}`} title="Download a site-free PNG"><ArrowDownToLine size={16} /><span>Wrapped</span></button></nav>

    <details className="quick-method"><summary><CircleHelp size={12} />What do these numbers mean?</summary><p>Distance sums movement down and up in CSS pixels. Metres/kilometres are screen-equivalent estimates, not finger travel or exercise.</p><p>Active scrolling sums event-to-event intervals within a burst, not time on a website or watching videos. A single event can add distance with zero timed seconds; positive sub-second time shows &lt;1s. A burst ends after a 2-second pause.</p><p className="quick-raw">{Math.round(totals.distancePx).toLocaleString()} CSS px in this period. <ShieldCheck size={12} />Stored on this device.</p></details>
  </div>;
}