import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, CircleHelp, Globe2, LockKeyhole, Moon, Plus, Settings2, ShieldCheck, Sun, Trash2, X } from 'lucide-react';
import { Brand } from './Brand';
import { AllSitesControl } from './AllSitesControl';
import { SiteInsights, SiteInsightsControl } from './SiteInsights';
import { PopupOverview } from './PopupOverview';
import { DashboardOverview } from './DashboardOverview';
import { SmartInsights } from './SmartInsights';
import { WrappedPreview } from './WrappedPreview';
import { emptyDay, lastSevenDays, localDate, sumDays } from '../analytics/metrics';
import { send } from '../utils/client';
import { normalizeSite, sitePattern } from '../utils/sites';
import { captureWrapped, type WrappedPeriod, type WrappedSnapshot } from '../wrapped/model';
import type { Snapshot } from '../types';

type Page = 'popup' | 'dashboard' | 'options';
const EMPTY: Snapshot = { settings: { trackingEnabled: false, approvedSites: [], allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null, epoch: '', theme: 'dark' }, days: [] };

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
  const [preview, setPreview] = useState<{ snapshot: WrappedSnapshot; period: WrappedPeriod } | null>(null);
  const { settings } = snapshot;
  const week = lastSevenDays(snapshot.days);
  const today = week.at(-1) ?? emptyDay(localDate());
  const totals = period === 'week' ? sumDays(week) : today;
  const loading = initializing || !hasSnapshot;
  const isPopup = page === 'popup';

  const refresh = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) throw new Error('Open this page from the installed ScrollMiles extension to start tracking.');
    const data = await send<Snapshot>({ type: 'GET_SNAPSHOT' });
    setSnapshot(data);
    setHasSnapshot(true);
    setLoadError('');
    document.documentElement.dataset.theme = data.settings.theme;
    return data;
  }, []);

  useEffect(() => {
    setPreview((current) => current && current.snapshot.epoch !== settings.epoch ? null : current);
  }, [settings.epoch]);

  useEffect(() => {
    if (!preview || typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    // Close frozen cards immediately on deletion/policy change in another tab.
    // The preview URL is revoked by its component cleanup, not left exportable.
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const next = changes.settings?.newValue as { epoch?: string } | undefined;
      if (area === 'local' && next?.epoch && next.epoch !== preview.snapshot.epoch) setPreview(null);
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, [preview]);

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

  const share = () => {
    if (!hasSnapshot || busy || loadError) return;
    setNotice(''); setError('');
    setPreview({ snapshot: captureWrapped(snapshot.days, settings.epoch), period });
  };

  async function refreshPreview(): Promise<void> {
    setBusy(true);
    try {
      const data = await refresh();
      setPreview((current) => current && current.snapshot.epoch === data.settings.epoch
        ? { ...current, snapshot: captureWrapped(data.days, data.settings.epoch) } : null);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'Could not refresh preview totals.'); }
    finally { setBusy(false); }
  }

  return <div className={isPopup ? 'app popup' : 'app'}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="header"><Brand />{!isPopup && <nav className="main-nav" aria-label="Main navigation"><a href="dashboard.html" className={page === 'dashboard' ? 'nav-active' : ''}>Overview</a><a href="options.html" className={page === 'options' ? 'nav-active' : ''}>Privacy & settings</a></nav>}<div className="header-actions">{!isPopup && <span className="local-chip"><LockKeyhole size={12} /> On-device only</span>}<button className="icon-button theme-button" aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} disabled={busy || loading} onClick={() => { void act(() => send({ type: 'SET_THEME', theme: settings.theme === 'dark' ? 'light' : 'dark' })); }}>{settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>{isPopup && <a className="icon-button quick-settings" href="options.html" target="_blank" rel="noreferrer" aria-label="Privacy and settings"><Settings2 size={16} /></a>}</div></header>

    <main id="main-content" tabIndex={-1}>
      {loadError && <div className="load-feedback" role="alert"><p><strong>{hasSnapshot ? 'These totals may be out of date.' : 'Your statistics could not be loaded.'}</strong>{loadError} Tracking status could not be verified.</p><button className="button ghost" disabled={initializing} onClick={() => {
        setLoading(true);
        void refresh().catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : 'Could not load your stats.')).finally(() => setLoading(false));
      }}>Retry loading</button></div>}
      {error && <div className="message error" role="alert"><CircleHelp size={17} /><span>{error}</span><button aria-label="Dismiss error" className="icon-button" onClick={() => setError('')}><X size={15} /></button></div>}
      {initializing && <div className="sr-only" role="status">Loading your local statistics.</div>}
      {notice && <div className="message success" role="status"><Check size={16} />{notice}</div>}

      {!hasSnapshot ? <section className="panel unavailable-panel"><h1>{initializing ? 'Opening your local journey…' : 'Your data deserves a proper read.'}</h1><p>{initializing ? 'Reading the statistics stored on this device.' : 'An unavailable database is not the same as zero activity. Retry loading before viewing totals or changing tracking.'}</p><a className="button ghost" href="privacy.html" target={isPopup ? '_blank' : undefined} rel="noreferrer">Read the privacy notice<ArrowUpRight size={14} /></a></section> : isPopup ? <PopupOverview snapshot={snapshot} totals={totals} period={period} onPeriodChange={setPeriod} disabled={busy || loading} statusUnverified={!!loadError} siteForm={siteForm} run={act} onExport={share} /> : page === 'options' ? <>
        <div className="page-heading"><div className="eyebrow"><ShieldCheck size={14} /> YOUR DATA. YOUR RULES.</div><h1>A little tracking.<br /><span>A lot of privacy.</span></h1><p>Only the websites you choose. Only on this device.</p></div>
        <AllSitesControl supported={snapshot.capabilities?.allSiteAccess === true} enabled={settings.allSitesEnabled} disabled={busy || loading} run={act} />
        <SiteInsightsControl snapshot={snapshot} disabled={busy || loading} run={act} />
        <div className="settings-layout"><section className="panel settings-panel"><div className="section-heading"><h2>Tracking controls</h2><Settings2 size={18} /></div><div className="setting-row"><div><h3>Scroll tracking</h3><p>Pause collection everywhere, instantly.</p></div><button className={`toggle ${settings.trackingEnabled ? 'on' : ''}`} role="switch" aria-checked={settings.trackingEnabled} aria-label="Scroll tracking" disabled={busy || loading} onClick={() => { void act(() => send({ type: 'SET_TRACKING', enabled: !settings.trackingEnabled })); }}><span /></button></div><div className="divider" /><h3>{settings.allSitesEnabled ? 'Excluded websites' : 'Your enabled websites'} <span className="count">{settings.allSitesEnabled ? settings.excludedSites.length : settings.approvedSites.length}</span></h3><p className="muted small">{settings.allSitesEnabled ? 'Excluded hosts are not collected. Exclusions are ScrollMiles controls, not revocation of Chrome’s broad host permission.' : 'Exact hostnames only. Subdomains and HTTP/HTTPS are separate. Access covers all paths and ports on each enabled host.'}</p><p className="muted small">For YouTube video pages, use www.youtube.com. All paths, including /watch and comments, are covered.</p>{siteForm}<div className="site-list">{(settings.allSitesEnabled ? settings.excludedSites : settings.approvedSites).length ? (settings.allSitesEnabled ? settings.excludedSites : settings.approvedSites).map((site) => <div className="site-row" key={site}><Globe2 size={16} /><span>{site}</span><button className="icon-button remove-site" aria-label={settings.allSitesEnabled ? `Stop excluding ${site}` : `Remove ${site}`} disabled={busy} onClick={() => { void act(() => send({ type: settings.allSitesEnabled ? 'INCLUDE_SITE' : 'REMOVE_SITE', site }), settings.allSitesEnabled ? 'Exclusion removed. This website can be collected again.' : 'Website removed and its permission revoked.'); }}><X size={16} /></button></div>) : <div className="empty-sites">{settings.allSitesEnabled ? 'No exclusions. All supported websites are included when tracking is not paused.' : 'No websites enabled. Nothing is being tracked.'}</div>}</div><p className="privacy-hint"><LockKeyhole size={13} />{settings.allSitesEnabled ? 'Exclude banking, health, work, and other sensitive websites. Exclude each exact subdomain separately.' : 'Keep banking, health, work, and other sensitive websites off this list.'}</p></section>
        <aside className="panel privacy-panel"><span className="large-icon"><ShieldCheck size={28} /></span><h2>Private isn’t an upgrade.</h2><p>It’s how ScrollMiles works.</p><ul className="privacy-list">{['No accounts or cloud uploads', 'No page text, searches, or keystrokes', 'No saved full URLs or browsing history', 'No advertising or third-party analytics', 'No incognito tracking'].map((text) => <li key={text}><Check size={15} />{text}</li>)}</ul><div className="privacy-receipt"><span>Stored on this device</span><strong>Daily totals + enabled hostnames</strong><span>Automatic history retention</span><strong>90 calendar days</strong></div><a className="text-link privacy-policy-link" href="privacy.html">Read the full privacy notice<ArrowUpRight size={14} /></a></aside></div>
        <section className="panel danger-panel"><div><h2>A clean slate</h2><p>Delete all recorded totals and pause tracking. Website choices and theme stay saved. There is no undo.</p></div>{confirmDelete ? <div className="delete-confirm" role="group" aria-label="Confirm deletion"><button className="button ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button className="button danger" disabled={busy} onClick={() => { void act(async () => { await send({ type: 'CLEAR_DATA' }); setConfirmDelete(false); }, 'All history deleted. Tracking is paused.'); }}>Delete & pause</button></div> : <button className="button danger" disabled={busy || loading} onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete history</button>}</section>
      </> : <DashboardOverview snapshot={snapshot} totals={totals} week={week} period={period} onPeriodChange={setPeriod} disabled={busy || loading} statusUnverified={!!loadError} siteForm={siteForm} run={act} onPreview={share}>
        <SmartInsights key={settings.epoch} snapshot={snapshot} period={period} stale={!!loadError} />
        <SiteInsights snapshot={snapshot} disabled={busy || loading} run={act} period={period} onPeriodChange={setPeriod} />
      </DashboardOverview>}
    </main>
    <footer><span><span className="footer-dot" />{isPopup ? 'Local-first. Always.' : 'Made for curiosity, not screen-time guilt.'}</span><a href="privacy.html" target={isPopup ? '_blank' : undefined} rel="noreferrer">Privacy notice</a>{!isPopup && <span><ShieldCheck size={13} />Your data never leaves this device.</span>}</footer>
    {preview && preview.snapshot.epoch === settings.epoch && <WrappedPreview snapshot={preview.snapshot} initialPeriod={preview.period} unavailable={busy || !!loadError} onClose={() => setPreview(null)} onRefresh={() => { void refreshPreview(); }} />}
  </div>;
}