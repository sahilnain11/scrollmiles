import type { Settings } from '../types';

export const ALL_SITE_ORIGINS = ['https://*/*', 'http://*/*'];

/** Store only scheme + hostname, never path/query/fragment/userinfo. */
export function normalizeSite(input: string): string {
  const url = new URL(input.includes('://') ? input : `https://${input}`);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('Enter an http or https website, such as example.com.');
  }
  if (url.hostname === 'chromewebstore.google.com' || (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))) {
    throw new Error('Chrome does not allow extensions to track the Web Store.');
  }
  return `${url.protocol}//${url.hostname}`;
}

export function sitePattern(site: string): string {
  return `${site}/*`;
}

export function isApprovedUrl(url: string, sites: string[]): boolean {
  try { return sites.includes(normalizeSite(url)); } catch { return false; }
}

export function canTrackUrl(url: string, settings: Pick<Settings, 'allSitesEnabled' | 'approvedSites' | 'excludedSites'>): boolean {
  try {
    const site = normalizeSite(url);
    return settings.allSitesEnabled ? !settings.excludedSites.includes(site) : settings.approvedSites.includes(site);
  } catch { return false; }
}