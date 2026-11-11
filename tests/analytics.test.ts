import { describe, expect, it } from 'vitest';
import { CSS_PX_PER_METRE, daysAgo, distanceLabel, durationLabel, lastSevenDays, localDate, sumDays } from '../src/analytics/metrics';
import { normalizeSite, isApprovedUrl, canTrackUrl } from '../src/utils/sites';
import { isCheckpoint } from '../src/utils/validation';

describe('daily reporting', () => {
  it('uses local calendar dates rather than UTC slices', () => {
    expect(localDate(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02');
  });
  it('walks calendar days across month and year boundaries', () => {
    expect(daysAgo(1, new Date(2026, 0, 1))).toBe('2025-12-31');
  });
  it('fills missing days with real zeroes', () => {
    const week = lastSevenDays([{ date: '2026-11-11', distancePx: 100, actions: 2, activeMs: 50 }], new Date(2026, 10, 11));
    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe('2026-11-05');
    expect(week[0]?.distancePx).toBe(0);
    expect(sumDays(week).distancePx).toBe(100);
  });
  it('converts only the display unit, not the canonical measurement', () => {
    expect(distanceLabel(CSS_PX_PER_METRE).unit).toBe('m');
    expect(distanceLabel(CSS_PX_PER_METRE * 1_000).unit).toBe('km');
  });
  it('formats short and long active scrolling durations', () => {
    expect(durationLabel(0)).toBe('0s');
    expect(durationLabel(65_000)).toBe('1m');
    expect(durationLabel(3_665_000)).toBe('1h 1m');
  });
});

describe('privacy boundaries', () => {
  it('covers YouTube paths only on the exact enabled hostname in selected mode', () => {
    const selected = { allSitesEnabled: false, approvedSites: ['https://youtube.com'], excludedSites: [] };
    expect(canTrackUrl('https://www.youtube.com/watch?v=fixture#comments', selected)).toBe(false);
    selected.approvedSites = ['https://www.youtube.com'];
    expect(canTrackUrl('https://www.youtube.com/watch?v=fixture#comments', selected)).toBe(true);
  });
  it('includes subdomains in all-site mode while respecting exact-host exclusions and protected pages', () => {
    const all = { allSitesEnabled: true, approvedSites: [], excludedSites: ['https://bank.example'] };
    expect(canTrackUrl('https://www.youtube.com/watch?v=fixture', all)).toBe(true);
    expect(canTrackUrl('https://bank.example/private', all)).toBe(false);
    expect(canTrackUrl('https://sub.bank.example', all)).toBe(true);
    for (const url of ['chrome://settings', 'file:///private', 'https://chromewebstore.google.com/detail/fixture']) expect(canTrackUrl(url, all)).toBe(false);
  });
  it('normalizes website input without keeping a path or search query', () => {
    expect(normalizeSite('https://Example.com/search?q=private#section')).toBe('https://example.com');
    expect(normalizeSite('example.com')).toBe('https://example.com');
    expect(normalizeSite('http://localhost:3000/test')).toBe('http://localhost');
  });
  it('does not silently approve other subdomains or protocols', () => {
    expect(isApprovedUrl('https://example.com/a', ['https://example.com'])).toBe(true);
    expect(isApprovedUrl('https://sub.example.com', ['https://example.com'])).toBe(false);
    expect(isApprovedUrl('http://example.com', ['https://example.com'])).toBe(false);
  });
  it('rejects browser pages, credentials and the Chrome Web Store', () => {
    for (const site of ['chrome://settings', 'file:///private', 'https://user:pass@example.com', 'https://chromewebstore.google.com']) {
      expect(() => normalizeSite(site)).toThrow();
    }
  });
  it('rejects oversized or malformed measurements and stale messages', () => {
    const valid = {
      date: localDate(), epoch: crypto.randomUUID(), streamId: crypto.randomUUID(),
      sequence: 1, timezone: 'UTC', recordedAt: Date.now(), distancePx: 100, actions: 1, activeMs: 0,
    };
    expect(isCheckpoint(valid)).toBe(true);
    expect(isCheckpoint({ ...valid, distancePx: Infinity })).toBe(false);
    expect(isCheckpoint({ ...valid, actions: -1 })).toBe(false);
    expect(isCheckpoint({ ...valid, recordedAt: 0 })).toBe(false);
    expect(isCheckpoint({ ...valid, date: daysAgo(90) })).toBe(false);
  });
});