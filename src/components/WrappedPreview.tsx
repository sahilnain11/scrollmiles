import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, LockKeyhole, RefreshCw, X } from 'lucide-react';
import { distanceLabel } from '../analytics/metrics';
import { siteScrollTime } from '../analytics/sites';
import { downloadCard, renderCard } from '../wrapped/CardRenderer';
import { wrappedCard, wrappedDateLabel, type WrappedCard, type WrappedPeriod, type WrappedSnapshot } from '../wrapped/model';

interface Props {
  snapshot: WrappedSnapshot;
  initialPeriod: WrappedPeriod;
  unavailable: boolean;
  onClose(): void;
  onRefresh(): void;
}

export function WrappedPreview({ snapshot, initialPeriod, unavailable, onClose, onRefresh }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [period, setPeriod] = useState(initialPeriod);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState<{ url: string; card: WrappedCard; snapshot: WrappedSnapshot; attempt: number }>();
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => { element.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setFailure(''); setNotice('');
    const card = wrappedCard(snapshot, period);
    void renderCard(card).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setReady({ url, card, snapshot, attempt });
    }).catch((error: unknown) => {
      if (active) setFailure(error instanceof Error ? error.message : 'The PNG preview could not be created.');
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [snapshot, period, attempt]);

  const card = wrappedCard(snapshot, period);
  const image = ready?.snapshot === snapshot && ready.card.period === period && ready.attempt === attempt ? ready : undefined;
  const distance = distanceLabel(card.stats.distancePx);
  return <dialog ref={dialog} className="wrapped-dialog" aria-labelledby="wrapped-preview-heading" aria-describedby="wrapped-preview-description" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
  }}>
    <header className="wrapped-dialog-header"><div><div className="eyebrow">A LITTLE STORY. JUST YOURS.</div><h2 id="wrapped-preview-heading">Your Wrapped preview</h2></div><button autoFocus className="icon-button" aria-label="Close Wrapped preview" onClick={onClose}><X size={18} /></button></header>
    <p id="wrapped-preview-description">This is the actual PNG. Download saves exactly this image, with no website names or browsing history.</p>
    <div className="wrapped-period" role="group" aria-label="Wrapped period"><button aria-pressed={period === 'today'} onClick={() => setPeriod('today')}>Today</button><button aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Last 7 days</button></div>
    <div className="wrapped-dialog-layout"><div className="wrapped-image-area" aria-busy={!image && !failure}>
      {image ? <img src={image.url} width="1200" height="1200" alt={`Wrapped PNG preview for ${wrappedDateLabel(card)}: ${distance.value} ${distance.unit} estimated screen-equivalent distance, ${card.stats.actions} scroll bursts, ${siteScrollTime(card.stats.activeMs)} active scrolling.`} />
        : failure ? <div className="wrapped-image-error" role="alert"><h3>Couldn’t create the preview.</h3><p>{failure}</p><button className="button ghost" onClick={() => setAttempt((value) => value + 1)}>Retry preview</button></div>
          : <p role="status">Drawing your local PNG…</p>}
    </div><div className="wrapped-copy"><span className="wrapped-local"><LockKeyhole size={13} />Created on your device</span><h3>{wrappedDateLabel(card)}</h3><dl><div><dt>Screen-equivalent distance</dt><dd>{distance.value} {distance.unit}</dd></div><div><dt>Scroll bursts</dt><dd>{card.stats.actions.toLocaleString()}</dd></div><div><dt>Active scrolling</dt><dd>{siteScrollTime(card.stats.activeMs)}</dd></div></dl>
      <p>These are frozen totals from when you opened or refreshed this preview. New activity won’t silently change the downloaded card.</p>
      {card.stats.distancePx === 0 && <p className="wrapped-zero">No scrolling recorded for this period. Zero is shown honestly—no sample activity is added.</p>}
      {unavailable && <p className="wrapped-unavailable" role="alert">Current statistics could not be verified. Reload them before refreshing or downloading this card.</p>}
      <button className="button ghost" disabled={unavailable} onClick={onRefresh}><RefreshCw size={14} />Refresh preview totals</button>
      <p className="wrapped-safe-note">Distance is an estimate, not finger travel. Scrolling time is not total time online. Nothing is posted automatically.</p>
    </div></div>
    <footer className="wrapped-dialog-footer"><span>PNG · 1200 × 1200 · Site-free</span><button className="button primary" disabled={!image || !!failure || unavailable} onClick={() => {
      if (!image) return;
      try { downloadCard(image.url, image.card.filename); setNotice('Your previewed PNG has been downloaded.'); }
      catch (error: unknown) { setNotice(error instanceof Error ? error.message : 'The download could not start.'); }
    }}><ArrowDownToLine size={16} />Download PNG</button></footer>
    {notice && <p className="wrapped-download-status" role="status">{notice}</p>}
  </dialog>;
}