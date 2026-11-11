import { useState } from 'react';
import { Globe2, ShieldCheck } from 'lucide-react';
import { ALL_SITE_ORIGINS } from '../utils/sites';
import { RELOAD_EXTENSION_MESSAGE, send } from '../utils/client';

interface Props {
  supported: boolean;
  enabled: boolean;
  disabled: boolean;
  run(work: () => Promise<unknown>, notice?: string): Promise<void>;
}

export function AllSitesControl({ supported, enabled, disabled, run }: Props) {
  const [confirm, setConfirm] = useState(false);

  function grant(): void {
    if (!supported || disabled) return;
    let permission: Promise<boolean>;
    // Must run in this explicit click gesture, never after an awaited message.
    try { permission = chrome.permissions.request({ origins: ALL_SITE_ORIGINS }); }
    catch (error) { void run(() => Promise.reject(error)); return; }
    void run(async () => {
      if (!await permission) throw new Error('All-site permission was not granted. Your existing website choices are unchanged.');
      await send({ type: 'SET_ALL_SITES', enabled: true });
      setConfirm(false);
    }, 'All-site access enabled. Add exclusions for websites you do not want tracked.');
  }

  return <section className="panel all-sites-control" aria-labelledby="all-sites-heading">
    <div className="all-sites-heading"><span className="sites-icon"><Globe2 size={22} /></span><div><h2 id="all-sites-heading">All supported websites</h2><p>{enabled ? 'All-site access is on. Tracking still follows your pause control and exclusions.' : 'Prefer one permission? Choose this instead of adding each website.'}</p></div></div>
    {!supported ? <p className="all-sites-warning" role="alert">{RELOAD_EXTENSION_MESSAGE}</p> : enabled ? <>
      <p className="all-sites-warning">Turning this off revokes website access and clears selected-site permissions. Earlier totals and your exclusion list stay saved; enable individual websites again afterwards.</p>
      <button className="button ghost" disabled={disabled} onClick={() => { void run(() => send({ type: 'SET_ALL_SITES', enabled: false }), 'All-site access revoked. No websites are enabled.'); }}>Turn off all-site access</button>
    </> : confirm ? <div className="all-sites-confirm" role="group" aria-label="Confirm all-site access">
      <p><ShieldCheck size={16} />This includes sensitive sites unless you exclude them. Chrome will ask for access to all HTTP and HTTPS websites, including subdomains. Browser-internal pages, the Web Store, and incognito stay unsupported. No activity leaves this device.</p>
      <div><button className="button ghost" disabled={disabled} onClick={() => setConfirm(false)}>Keep selected websites</button><button className="button primary" disabled={disabled} onClick={grant}>Allow all supported websites</button></div>
    </div> : <button className="button ghost" disabled={disabled} onClick={() => setConfirm(true)}>Set up all-site access</button>}
  </section>;
}