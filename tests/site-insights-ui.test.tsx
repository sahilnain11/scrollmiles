// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { localDate, daysAgo } from '../src/analytics/metrics';
import { siteIdentity, siteScrollTime } from '../src/analytics/sites';
import { SiteInsights } from '../src/components/SiteInsights';
import type { Snapshot } from '../src/types';

// Test-only activity; never inserted into the production UI or actual history.
const snapshot: Snapshot = {
  settings: { trackingEnabled: true, approvedSites: [], allSitesEnabled: true, excludedSites: [], siteInsightsEnabled: true, siteInsightsSince: Date.now(), epoch: 'test', theme: 'dark' },
  days: [],
  siteHours: [
    { site: 'https://alpha.example', date: localDate(), hour: 10, distancePx: 2000, actions: 1, activeMs: 0 },
    { site: 'https://beta.example', date: localDate(), hour: 16, distancePx: 1000, actions: 3, activeMs: 500 },
    { site: 'https://alpha.example', date: daysAgo(1), hour: 11, distancePx: 500, actions: 1, activeMs: 10_000 },
  ],
};

afterEach(cleanup);

function Harness() {
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  return <SiteInsights snapshot={snapshot} disabled={false} run={vi.fn()} period={period} onPeriodChange={setPeriod} />;
}

describe('readable website insights', () => {
  it('uses exact local hostname identities and honest sub-second formatting', () => {
    expect(siteIdentity('https://www.example.com')).toEqual({ hostname: 'www.example.com', protocol: 'HTTPS', initials: 'EX' });
    expect(siteIdentity('http://www.example.com').protocol).toBe('HTTP');
    expect(siteScrollTime(0)).toBe('0s');
    expect(siteScrollTime(500)).toBe('<1s');
    expect(siteScrollTime(65_000)).toBe('1m 5s');
    expect(siteScrollTime(3_665_000)).toBe('1h 1m');
  });

  it('sorts by measured scrolling time without changing the recorded-site share denominator', async () => {
    render(<Harness />);
    const navigation = screen.getByRole('navigation', { name: 'Choose a website to analyze' });
    expect(within(navigation).getAllByRole('button')[0]?.textContent).toContain('alpha.example');
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Sort websites by' }), 'activeMs');
    expect(within(navigation).getAllByRole('button')[0]?.textContent).toContain('beta.example');
    await userEvent.setup().click(within(navigation).getAllByRole('button')[0]!);
    expect(screen.getByRole('heading', { name: 'beta.example' })).toBeTruthy();
    expect(screen.getByText('33.3%')).toBeTruthy();
  });

  it('keeps search usable when no hostname matches and recovers after clearing', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const search = screen.getByRole('searchbox', { name: 'Find a recorded website' });
    await user.type(search, 'no-such-site');
    expect(screen.getByRole('status').textContent).toContain('No websites match');
    expect(screen.getByRole('heading', { name: 'alpha.example' })).toBeTruthy();
    await user.clear(search);
    await user.type(search, 'beta');
    const navigation = screen.getByRole('navigation', { name: 'Choose a website to analyze' });
    expect(within(navigation).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('33.3%')).toBeTruthy();
    await user.clear(search);
    expect(within(navigation).getAllByRole('button')).toHaveLength(2);
  });

  it('explains untimed scrolls and switches chart metrics and daily detail', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    expect(screen.getByText('Distance recorded, no timed interval yet')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Scrolling time' }));
    expect(screen.getByText('No timed interval in this period. Scroll distance can still be recorded.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'By day' }));
    expect(screen.getByRole('heading', { name: 'Seven-day trend' })).toBeTruthy();
    await user.click(screen.getByText('View seven-day trend values'));
    expect(within(screen.getByRole('table', { name: 'Seven-day trend — exact scrolling totals' })).getAllByRole('row')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Last 7 days: website insights' }));
    expect(screen.getByRole('button', { name: 'Last 7 days: website insights' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('lets keyboard users explore individual hourly chart values', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const chart = screen.getByRole('group', { name: /Hourly rhythm: distance/ });
    const buttons = within(chart).getAllByRole('button');
    buttons[10]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(buttons[11]);
    expect(buttons[11]?.getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(buttons[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(buttons[23]);
  });
});