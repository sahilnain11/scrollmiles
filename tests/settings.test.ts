import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSettings } from '../src/storage/settings';

afterEach(() => vi.unstubAllGlobals());

describe('settings migration', () => {
  it('defaults new installs to selected websites without broad access', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({}), set } } });
    const settings = await readSettings();
    expect(settings.allSitesEnabled).toBe(false);
    expect(settings.approvedSites).toEqual([]);
    expect(settings.excludedSites).toEqual([]);
    expect(settings.siteInsightsEnabled).toBe(false);
    expect(settings.siteInsightsSince).toBe(null);
    expect(set).toHaveBeenCalled();
  });
  it('never broadens an existing install when adding the new settings fields', async () => {
    const old = { trackingEnabled: false, approvedSites: ['https://example.com'], theme: 'light', epoch: crypto.randomUUID() };
    vi.stubGlobal('chrome', { storage: { local: { get: async () => ({ settings: old }) } } });
    expect(await readSettings()).toEqual({ ...old, allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null });
  });
});