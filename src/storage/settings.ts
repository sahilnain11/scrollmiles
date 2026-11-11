import type { Settings } from '../types';

export async function readSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  if (result.settings) {
    const stored = result.settings as Settings;
    // Existing installs never gain broad access automatically, even if Chrome
    // happens to have a wider grant. Only an explicit UI opt-in enables it.
    return {
      ...stored, allSitesEnabled: stored.allSitesEnabled === true, excludedSites: stored.excludedSites ?? [],
      siteInsightsEnabled: stored.siteInsightsEnabled === true,
      siteInsightsSince: stored.siteInsightsSince ?? null,
    };
  }
  const settings: Settings = {
    trackingEnabled: true,
    approvedSites: [],
    allSitesEnabled: false,
    excludedSites: [],
    siteInsightsEnabled: false,
    siteInsightsSince: null,
    epoch: crypto.randomUUID(),
    theme: 'dark',
  };
  await writeSettings(settings);
  return settings;
}

export async function writeSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}