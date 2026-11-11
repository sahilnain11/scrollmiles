import { useEffect } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Brand } from './Brand';
import { privacySections, PRIVACY_UPDATED } from '../privacy/policy';

export function PrivacyPage() {
  useEffect(() => {
    // The notice remains usable even if the worker or historical database fails.
    // VS Code's integrated browser has no extension storage API. The notice
    // must also work as a regular static page without faking extension state.
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    void chrome.storage.local.get('settings').then(({ settings }: { settings?: { theme?: string } }) => {
      document.documentElement.dataset.theme = settings?.theme === 'light' ? 'light' : 'dark';
    }).catch(() => undefined);
  }, []);

  return <div className="app privacy-page">
    <a className="skip-link" href="#privacy-notice">Skip to privacy notice</a>
    <header className="header"><Brand /><nav className="main-nav" aria-label="Main navigation"><a href="dashboard.html">Overview</a><a href="options.html">Privacy & settings</a></nav><span className="local-chip header-actions"><LockKeyhole size={12} /> On-device only</span></header>
    <main id="privacy-notice" tabIndex={-1}>
      <div className="page-heading"><div className="eyebrow"><ShieldCheck size={14} /> PLAIN WORDS. NO SMALL PRINT.</div><h1>Your scrolling.<br /><span>Your business.</span></h1><p>Privacy notice for the local-only beta · Updated <time dateTime={PRIVACY_UPDATED}>November 11, 2026</time></p></div>
      <div className="privacy-notice-layout">
        <aside className="panel privacy-contents"><h2>At a glance</h2><p>No accounts. No uploads.<br />Nothing enabled without your choice.</p><nav aria-label="Privacy notice contents"><ol>{privacySections.map((section, index) => <li key={section.title}><a href={`#privacy-${index + 1}`}>{section.title}</a></li>)}</ol></nav><a className="text-link" href="options.html"><ArrowLeft size={14} />Manage privacy controls</a></aside>
        <article className="panel privacy-copy" aria-label="Full privacy notice">{privacySections.map((section, index) => <section key={section.title} id={`privacy-${index + 1}`} tabIndex={-1}><h2><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</article>
      </div>
    </main>
    <footer><span><span className="footer-dot" />Made for curiosity, not screen-time guilt.</span><a href="options.html">Back to privacy controls</a></footer>
  </div>;
}