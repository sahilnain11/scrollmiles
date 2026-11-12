// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartInsights } from '../src/components/SmartInsights';
import { daysAgo, localDate } from '../src/analytics/metrics';
import type { Snapshot } from '../src/types';

afterEach(cleanup);
const now = new Date(2026, 10, 12, 12);
function data(): Snapshot {
  return {
    settings: { trackingEnabled: true, approvedSites: ['https://private.example'], allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null, epoch: 'test', theme: 'dark' },
    days: [{ date: localDate(now), distancePx: 100, actions: 1, activeMs: 200 }], comparisonDays: [],
    siteHours: [{ date: localDate(now), hour: 10, site: 'https://private.example', distancePx: 100, actions: 1, activeMs: 200 }],
  };
}

describe('Smart Insights consent and honest observations', () => {
  it('does not derive hours from anonymous data or leaked detail when consent is off', () => {
    render(<SmartInsights snapshot={data()} period="today" stale={false} now={now} />);
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.getByText('Hourly detail unavailable')).toBeTruthy();
    expect(screen.getByText(/Daily anonymous history cannot be split into hours/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Review Website insights/ }).getAttribute('href')).toBe('options.html');
    expect(screen.getByText(/Not enough comparable history yet/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('private.example');
  });
  it('exposes keyboard-readable exact hourly detail without claiming inactivity or browsing time', async () => {
    const snapshot = data(); snapshot.settings.siteInsightsEnabled = true;
    render(<SmartInsights snapshot={snapshot} period="today" stale={false} now={now} />);
    const grid = screen.getByRole('grid', { name: /Seven-day recorded-site heatmap/ });
    const cells = within(grid).getAllByRole('gridcell');
    expect(cells).toHaveLength(168);
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    const user = userEvent.setup();
    await user.click(cells[154]!);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(cells[155]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(cells[131]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(cells[120]);
    await user.keyboard('{Control>}{End}{/Control}');
    expect(document.activeElement).toBe(cells[167]);
    expect(screen.getByText('No recorded detail for this hour. This does not prove inactivity.')).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Heatmap metric' }), 'activeMs');
    expect(screen.getByRole('grid', { name: /active scrolling/ })).toBeTruthy();
    await user.click(cells[154]!);
    expect(screen.getByText(/<1s · 200 ms/)).toBeTruthy();
    await user.click(screen.getByText('View exact heatmap values'));
    expect(within(screen.getByRole('table', { name: 'Seven-day recorded-site hourly totals' })).getAllByRole('row')).toHaveLength(169);
    expect(document.body.textContent).not.toContain('private.example');
  });
  it('removes the heatmap on opt-out and never derives observations on a stale read', () => {
    const snapshot = data(); snapshot.settings.siteInsightsEnabled = true;
    const view = render(<SmartInsights snapshot={snapshot} period="week" stale={false} now={now} />);
    expect(screen.getByRole('grid')).toBeTruthy();
    view.rerender(<SmartInsights snapshot={{ ...snapshot, settings: { ...snapshot.settings, siteInsightsEnabled: false } }} period="week" stale={false} now={now} />);
    expect(screen.queryByRole('grid')).toBeNull();
    view.rerender(<SmartInsights snapshot={snapshot} period="week" stale now={now} />);
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.queryByText('Recorded scrolls')).toBeNull();
    expect(screen.getByText(/previous totals are not treated as fresh/)).toBeTruthy();
  });
  it('shows genuine zero/insufficient states and older-worker guidance, not fabricated comparisons', () => {
    const snapshot = data(); snapshot.days = [];
    const view = render(<SmartInsights snapshot={snapshot} period="week" stale={false} now={now} />);
    expect(screen.getByText('No recorded day yet')).toBeTruthy();
    expect(screen.getByText(/No scrolling recorded in this period/)).toBeTruthy();
    expect(screen.getByText(/No percentage is inferred/)).toBeTruthy();
    view.rerender(<SmartInsights snapshot={{ ...snapshot, comparisonDays: undefined }} period="week" stale={false} now={now} />);
    expect(screen.getByText(/Comparison history is unavailable from this worker/)).toBeTruthy();
    expect(screen.queryByText('Recent complete period')).toBeNull();
  });
  it('shows exact complete-window changes neutrally and distinguishes a zero baseline', () => {
    const snapshot = data();
    snapshot.comparisonDays = Array.from({ length: 14 }, (_, index) => ({ date: daysAgo(index + 1, now), distancePx: index < 7 ? 200 : 100, actions: 1, activeMs: 0 }));
    render(<SmartInsights snapshot={snapshot} period="week" stale={false} now={now} />);
    expect(screen.getByText('700 CSS px more')).toBeTruthy();
    expect(screen.getByText('100% more recorded')).toBeTruthy();
    expect(screen.getByText('No percentage: previous total is zero')).toBeTruthy();
    expect(screen.getByText(/not a measure of improvement/)).toBeTruthy();
    expect(screen.getByText('2026-11-05 – 2026-11-11')).toBeTruthy();
  });
  it('labels tied peaks explicitly instead of choosing an unsupported winner', () => {
    const snapshot = data(); snapshot.settings.siteInsightsEnabled = true;
    snapshot.days.push({ ...snapshot.days[0]!, date: daysAgo(1, now) });
    snapshot.siteHours!.push({ ...snapshot.siteHours![0]!, hour: 11 });
    render(<SmartInsights snapshot={snapshot} period="week" stale={false} now={now} />);
    expect(screen.getByText('2 days tied')).toBeTruthy();
    expect(screen.getByText('2 hours tied')).toBeTruthy();
  });
});