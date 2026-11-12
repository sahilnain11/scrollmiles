// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardOverview } from '../src/components/DashboardOverview';
import { emptyDay, lastSevenDays, localDate, sumDays } from '../src/analytics/metrics';
import type { Snapshot } from '../src/types';

afterEach(cleanup);
const snapshot: Snapshot = {
  settings: { trackingEnabled: true, approvedSites: ['https://example.com'], allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null, epoch: 'test', theme: 'dark' },
  days: [{ date: localDate(), distancePx: 1000, actions: 2, activeMs: 500 }],
};

function Harness({ unavailable = false, firstUse = false }: { unavailable?: boolean; firstUse?: boolean }) {
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const data = firstUse ? { ...snapshot, days: [], settings: { ...snapshot.settings, approvedSites: [] } } : snapshot;
  const week = lastSevenDays(data.days);
  return <DashboardOverview snapshot={data} week={week} totals={period === 'week' ? sumDays(week) : week.at(-1) ?? emptyDay(localDate())} period={period} onPeriodChange={setPeriod} disabled={false} statusUnverified={unavailable} siteForm={<div>Exact website permission form</div>} run={vi.fn()} onPreview={vi.fn()}><section id="website-insights">Existing opted-in insights</section></DashboardOverview>;
}

describe('focused main dashboard', () => {
  it('shows real scrolling rather than unsupported browsing-time/session/personality claims', () => {
    render(<Harness />);
    expect(screen.getByText('<1s', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText('The raw distance')).toBeTruthy();
    expect(screen.queryByText(/Active browsing|Sessions|Night Owl|focus score/i)).toBeNull();
    expect(screen.queryByText('Exact website permission form')).toBeNull();
    expect(screen.getByRole('link', { name: 'Website insights' }).getAttribute('href')).toBe('#website-insights');
    expect(screen.getByRole('link', { name: 'Wrapped' }).getAttribute('href')).toBe('#wrapped');
  });
  it('makes first-use access explicit without offering an irrelevant pause control', () => {
    render(<Harness firstUse />);
    expect(screen.getByText('Exact website permission form')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Choose website access' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Pause tracking/ })).toBeNull();
    expect(screen.getByText('Your journey starts with a scroll.')).toBeTruthy();
  });
  it('gates pause and preview on stale status instead of claiming active collection', () => {
    render(<Harness unavailable />);
    expect(screen.getByRole('heading', { name: 'Status unavailable' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Pause tracking/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Preview my Wrapped' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('keeps seven-day scope/exact values explicit when switching the summary period', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(screen.getByRole('heading', { name: 'Your week, in scrolling.' })).toBeTruthy();
    expect(screen.getByText('Last 7 local calendar days · screen-equivalent distance')).toBeTruthy();
    const chart = screen.getByRole('group', { name: 'Daily scrolling distance' });
    await user.click(within(chart).getAllByRole('button')[0]!);
    expect(within(chart).getAllByRole('button')[0]?.getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByText('View exact daily totals'));
    expect(within(screen.getByRole('table', { name: 'Seven-day scrolling statistics' })).getAllByRole('row')).toHaveLength(8);
  });
});