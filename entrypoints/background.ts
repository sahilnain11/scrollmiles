import { defineBackground } from 'wxt/utils/define-background';
import { applyCheckpoint, clearHistory, clearSiteHistory, getWeek, getSiteWeek, getComparisonDays, getRetainedHistory, openStatsDatabase, pruneHistory, type StatsConnection } from '../src/storage/database';
import { readSettings, writeSettings } from '../src/storage/settings';
import { ALL_SITE_ORIGINS, canTrackUrl, normalizeSite, sitePattern } from '../src/utils/sites';
import { isCheckpoint } from '../src/utils/validation';
import type { Response, Settings } from '../src/types';

export default defineBackground(() => {
  // Only short operations live in memory. All important state is durable.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  };
  let database: Promise<StatsConnection> | undefined;
  function getDatabase(): Promise<StatsConnection> {
    if (!database) {
      const connection = openStatsDatabase();
      database = connection;
      // An opening failure must not poison this worker until Chrome restarts.
      // A later request (including the UI's Retry loading) can try again.
      void connection.catch(() => { if (database === connection) database = undefined; });
    }
    return database;
  }
  const scriptId = 'scrollmiles-tracker';

  async function finishDetailedDeletion(settings: Settings, db: StatsConnection): Promise<void> {
    if (settings.pendingSiteDeletion) {
      await clearSiteHistory(db, settings.pendingSiteDeletion);
      delete settings.pendingSiteDeletion;
      await writeSettings(settings);
    }
    if (!settings.siteInsightsEnabled) await clearSiteHistory(db);
  }

  async function reconcileScripts(settings: Settings, inject = false): Promise<void> {
    const matches = settings.trackingEnabled
      ? settings.allSitesEnabled ? ALL_SITE_ORIGINS : settings.approvedSites.map(sitePattern)
      : [];
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [scriptId] });
    if (!matches.length) {
      if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
      return;
    }
    const script = {
      id: scriptId, matches, js: ['content-scripts/content.js'],
      excludeMatches: settings.allSitesEnabled ? settings.excludedSites.map(sitePattern) : [],
      runAt: 'document_idle' as const, allFrames: false, persistAcrossSessions: true,
    };
    if (scripts.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
    if (!inject) return;
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map(async (tab) => {
      if (tab.id === undefined || tab.incognito || !tab.url || !canTrackUrl(tab.url, settings)) return;
      // Protected pages may reject injection even with host access.
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: script.js }).catch(() => undefined);
    }));
  }

  async function savePolicy(settings: Settings): Promise<void> {
    settings.epoch = crypto.randomUUID();
    await writeSettings(settings);
    await reconcileScripts(settings, true);
  }

  function isUi(sender: chrome.runtime.MessageSender): boolean {
    if (sender.id !== chrome.runtime.id || !sender.url) return false;
    if (sender.frameId !== undefined && sender.frameId !== 0) return false;
    try {
      // A section link/query does not change the trusted extension document.
      // Still compare the full canonical base URL, not a prefix or pathname
      // alone, so another origin/extension/lookalike page is never authorized.
      const documentUrl = new URL(sender.url);
      documentUrl.hash = '';
      documentUrl.search = '';
      return ['popup.html', 'dashboard.html', 'options.html'].some((page) => documentUrl.href === chrome.runtime.getURL(page));
    } catch { return false; }
  }

  async function handle(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
    if (!message || typeof message !== 'object' || sender.id !== chrome.runtime.id || sender.tab?.incognito) {
      throw new Error('Invalid sender.');
    }
    const request = message as Record<string, unknown>;
    const settings = await readSettings();
    const fromCollector = sender.frameId === 0 && sender.tab?.id !== undefined
      && !!sender.url && canTrackUrl(sender.url, settings);
    if (request.type === 'GET_SETTINGS' && (isUi(sender) || fromCollector)) return settings;
    if (request.type === 'CHECKPOINT') {
      if (!fromCollector || !settings.trackingEnabled || !isCheckpoint(request.checkpoint)) throw new Error('Tracking is not available.');
      if (request.checkpoint.epoch !== settings.epoch) return { accepted: false };
      if (settings.siteInsightsEnabled && request.checkpoint.hour === undefined) throw new Error('Reload this website to start the updated hourly collector.');
      const site = normalizeSite(sender.url!);
      if (!await chrome.permissions.contains({ origins: [sitePattern(site)] })) return { accepted: false };
      const db = await getDatabase();
      await pruneHistory(db);
      // The site comes from Chrome's validated sender, never from page payload.
      await applyCheckpoint(db, request.checkpoint, settings.siteInsightsEnabled ? site : undefined);
      return { accepted: true };
    }
    if (!isUi(sender)) throw new Error('This action is only available in ScrollMiles.');
    switch (request.type) {
      case 'GET_SNAPSHOT': {
        if (request.includeHistory !== undefined && typeof request.includeHistory !== 'boolean') throw new Error('Invalid history request.');
        const db = await getDatabase();
        const now = new Date();
        await pruneHistory(db, now);
        // Finish a disable/delete even if the worker stopped after saving consent.
        await finishDetailedDeletion(settings, db);
        return {
          settings, days: await getWeek(db, now),
          comparisonDays: await getComparisonDays(db, now),
          ...(request.includeHistory === true ? { history: await getRetainedHistory(db, now) } : {}),
          siteHours: settings.siteInsightsEnabled ? await getSiteWeek(db, now) : [],
          capabilities: { allSiteAccess: true, siteInsights: true, smartInsights: true, retainedHistory: true },
        };
      }
      case 'SET_SITE_INSIGHTS': {
        if (typeof request.enabled !== 'boolean') throw new Error('Invalid website insights setting.');
        const db = await getDatabase();
        if (request.enabled === settings.siteInsightsEnabled) {
          if (!request.enabled) await clearSiteHistory(db);
          return null;
        }
        // Starting fresh also finishes any interrupted earlier opt-out cleanup.
        if (request.enabled) await clearSiteHistory(db);
        settings.siteInsightsEnabled = request.enabled;
        settings.siteInsightsSince = request.enabled ? Date.now() : null;
        await savePolicy(settings);
        if (!request.enabled) await clearSiteHistory(db);
        return null;
      }
      case 'DELETE_SITE_INSIGHTS': {
        if (typeof request.site !== 'string' || request.site.length > 300) throw new Error('Invalid website.');
        const site = normalizeSite(request.site);
        // Rotate first; an old cumulative checkpoint must not recreate details.
        settings.pendingSiteDeletion = site;
        await savePolicy(settings);
        await finishDetailedDeletion(settings, await getDatabase());
        return null;
      }
      case 'SET_TRACKING':
        if (typeof request.enabled !== 'boolean') throw new Error('Invalid tracking setting.');
        settings.trackingEnabled = request.enabled;
        await savePolicy(settings);
        return null;
      case 'SET_THEME':
        if (request.theme !== 'dark' && request.theme !== 'light') throw new Error('Invalid theme.');
        settings.theme = request.theme;
        await writeSettings(settings);
        return null;
      case 'ADD_SITE': {
        if (settings.allSitesEnabled) throw new Error('All-site access is on. Use exclusions to choose websites not to track.');
        if (typeof request.site !== 'string' || request.site.length > 300) throw new Error('Invalid website.');
        const site = normalizeSite(request.site);
        if (!await chrome.permissions.contains({ origins: [sitePattern(site)] })) throw new Error('Website permission was not granted.');
        if (!settings.approvedSites.includes(site)) settings.approvedSites.push(site);
        await savePolicy(settings);
        return null;
      }
      case 'REMOVE_SITE': {
        if (settings.allSitesEnabled) throw new Error('Use an exclusion to stop tracking a website while all-site access is on.');
        if (typeof request.site !== 'string') throw new Error('Invalid website.');
        const site = normalizeSite(request.site);
        settings.approvedSites = settings.approvedSites.filter((item) => item !== site);
        await savePolicy(settings);
        await chrome.permissions.remove({ origins: [sitePattern(site)] });
        return null;
      }
      case 'SET_ALL_SITES': {
        if (typeof request.enabled !== 'boolean') throw new Error('Invalid website access setting.');
        if (request.enabled) {
          if (!await chrome.permissions.contains({ origins: ALL_SITE_ORIGINS })) throw new Error('All-site permission was not granted.');
          settings.allSitesEnabled = true;
          await savePolicy(settings);
        } else {
          // Revoke wildcard access, not just registration. Chrome can also
          // remove narrower grants covered by it, so return to no selected sites.
          settings.allSitesEnabled = false;
          settings.approvedSites = [];
          await savePolicy(settings);
          await chrome.permissions.remove({ origins: ALL_SITE_ORIGINS });
        }
        return null;
      }
      case 'EXCLUDE_SITE':
      case 'INCLUDE_SITE': {
        if (!settings.allSitesEnabled) throw new Error('Exclusions apply only while all-site access is on.');
        if (typeof request.site !== 'string' || request.site.length > 300) throw new Error('Invalid website.');
        const site = normalizeSite(request.site);
        settings.excludedSites = request.type === 'INCLUDE_SITE'
          ? settings.excludedSites.filter((item) => item !== site)
          : [...new Set([...settings.excludedSites, site])];
        await savePolicy(settings);
        return null;
      }
      case 'CLEAR_DATA':
        // Change the epoch first. Old in-flight messages can never restore deleted data.
        settings.trackingEnabled = false;
        await savePolicy(settings);
        await clearHistory(await getDatabase());
        return null;
      default:
        throw new Error('Unknown request.');
    }
  }

  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (response: Response<unknown>) => void) => {
    void serial(() => handle(message, sender)).then(
      (data) => sendResponse({ ok: true, data }),
      (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }),
    );
    return true;
  });

  async function restore(): Promise<void> {
    const settings = await readSettings();
    if (settings.allSitesEnabled && !await chrome.permissions.contains({ origins: ALL_SITE_ORIGINS })) {
      // Partial/external revocation fails closed. Never silently recreate a grant.
      settings.allSitesEnabled = false;
      settings.approvedSites = [];
      settings.epoch = crypto.randomUUID();
      await writeSettings(settings);
      await reconcileScripts(settings);
      await chrome.permissions.remove({ origins: ALL_SITE_ORIGINS });
    }
    const granted = await Promise.all(settings.approvedSites.map(async (site) =>
      await chrome.permissions.contains({ origins: [sitePattern(site)] }) ? site : null));
    const sites = granted.filter((site): site is string => site !== null);
    if (sites.length !== settings.approvedSites.length) {
      settings.approvedSites = sites;
      settings.epoch = crypto.randomUUID();
      await writeSettings(settings);
    }
    await reconcileScripts(settings, true);
    const db = await getDatabase();
    await finishDetailedDeletion(settings, db);
    await pruneHistory(db);
  }

  chrome.runtime.onInstalled.addListener(() => { void serial(restore).catch(console.error); });
  chrome.runtime.onStartup.addListener(() => { void serial(restore).catch(console.error); });
  chrome.permissions.onRemoved.addListener(() => { void serial(restore).catch(console.error); });
  // Also runs when the worker wakes after suspension; registration is idempotent.
  void serial(restore).catch(console.error);
});