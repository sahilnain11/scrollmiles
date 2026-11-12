// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/components/App';
import { daysAgo, localDate } from '../src/analytics/metrics';
import { send } from '../src/utils/client';
import { downloadCard, renderCard } from '../src/wrapped/CardRenderer';
import type { Snapshot } from '../src/types';

vi.mock('../src/utils/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/utils/client')>(), send: vi.fn(),
}));
vi.mock('../src/wrapped/CardRenderer', () => ({ renderCard: vi.fn().mockResolvedValue(new Blob(['test PNG'], { type: 'image/png' })), downloadCard: vi.fn() }));
const sendMock = vi.mocked(send);
const permission = vi.fn<(options: chrome.permissions.Permissions) => Promise<boolean>>();
let snapshot: Snapshot;

beforeEach(() => {
  snapshot = {
    settings: { trackingEnabled: true, approvedSites: ['https://example.com'], allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null, epoch: 'test', theme: 'dark' },
    days: [{ date: localDate(), distancePx: 500, actions: 2, activeMs: 500 }, { date: daysAgo(1), distancePx: 1000, actions: 3, activeMs: 5000 }],
    capabilities: { allSiteAccess: true, siteInsights: true },
  };
  sendMock.mockReset().mockImplementation(async (request) => {
    if (request.type === 'SET_TRACKING') snapshot.settings.trackingEnabled = request.enabled;
    return structuredClone(snapshot);
  });
  permission.mockReset().mockResolvedValue(false);
  vi.mocked(renderCard).mockClear();
  vi.mocked(downloadCard).mockClear();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:popup-test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
  vi.stubGlobal('chrome', { runtime: { id: 'popup-test' }, permissions: { request: permission } });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('popup quick glance', () => {
  it('previews real period totals and downloads only after explicit confirmation', async () => {
    render(<App page="popup" />);
    expect(await screen.findByText('<1s')).toBeTruthy();
    expect(screen.getByText('2', { selector: 'dd' })).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(screen.getByRole('heading', { name: 'Your week, in scrolling.' })).toBeTruthy();
    expect(screen.getByText('5s')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Preview Wrapped card for the last 7 days' }));
    await screen.findByRole('img', { name: /Wrapped PNG preview/ });
    expect(renderCard).toHaveBeenCalledWith(expect.objectContaining({ stats: { date: 'week', distancePx: 1500, actions: 5, activeMs: 5500 }, period: 'week' }));
    expect(downloadCard).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));
    expect(downloadCard).toHaveBeenCalledWith('blob:popup-test', 'scrollmiles-week.png');
    expect(JSON.stringify(vi.mocked(renderCard).mock.calls)).not.toContain('example.com');
  });

  it('pauses and resumes with one action while keeping website selection out of the popup', async () => {
    render(<App page="popup" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Tracking enabled. Pause tracking' }));
    expect(sendMock).toHaveBeenCalledWith({ type: 'SET_TRACKING', enabled: false });
    await user.click(await screen.findByRole('button', { name: 'Tracking paused. Resume tracking' }));
    expect(sendMock).toHaveBeenCalledWith({ type: 'SET_TRACKING', enabled: true });
    expect(screen.queryByRole('textbox', { name: 'Website to enable' })).toBeNull();
    expect(permission).not.toHaveBeenCalled();
  });

  it('distinguishes selected/all-site coverage from optional website-insights consent', async () => {
    snapshot.settings.allSitesEnabled = true;
    snapshot.settings.excludedSites = ['https://sensitive.example'];
    snapshot.settings.siteInsightsEnabled = true;
    render(<App page="popup" />);
    expect(await screen.findByText('All supported sites · 1 exact-host exclusion')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Website insights/ });
    expect(link.getAttribute('href')).toBe('dashboard.html#website-insights');
    expect(link.textContent).toContain('On');
    expect(screen.queryByRole('textbox', { name: 'Website to exclude' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Privacy and settings' }).getAttribute('target')).toBe('_blank');
    expect(permission).not.toHaveBeenCalled();
  });

  it('keeps informed first-use permission denial recoverable without approving the website', async () => {
    snapshot.settings.approvedSites = [];
    snapshot.days = [];
    render(<App page="popup" />);
    const user = userEvent.setup();
    expect(await screen.findByText('Choose a website to begin')).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: 'Website to enable' }), 'https://www.example.com/private?q=secret');
    await user.click(screen.getByRole('button', { name: 'Enable website' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Permission was not granted');
    expect(permission).toHaveBeenCalledWith({ origins: ['https://www.example.com/*'] });
    expect(sendMock.mock.calls.some(([request]) => request.type === 'ADD_SITE')).toBe(false);
    expect((screen.getByRole('button', { name: 'Enable website' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('link', { name: /Prefer all-site access/ }).getAttribute('href')).toBe('options.html');
  });

  it('explains untimed movement rather than inventing time, sessions, or personalities', async () => {
    snapshot.days[0]!.activeMs = 0;
    render(<App page="popup" />);
    expect(await screen.findByText('No timed interval yet')).toBeTruthy();
    await userEvent.setup().click(screen.getByText('What do these numbers mean?'));
    expect(screen.getByText(/A single event can add distance with zero timed seconds/)).toBeTruthy();
    expect(screen.queryByText(/Active browsing|Sessions|Night Owl|focus score/i)).toBeNull();
    expect(screen.getByRole('link', { name: /Website insights/ }).getAttribute('href')).toBe('options.html');
    expect(permission).not.toHaveBeenCalled();
  });

  it('never presents a failed load as zero stats and lets retry recover', async () => {
    sendMock.mockRejectedValueOnce(new Error('Could not open database.'));
    render(<App page="popup" />);
    expect((await screen.findByRole('alert')).textContent).toContain('statistics could not be loaded');
    expect(screen.queryByRole('region', { name: 'Scrolling summary' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pause tracking/ })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading' }));
    expect(await screen.findByRole('region', { name: 'Scrolling summary' })).toBeTruthy();
  });

  it('marks status unverified and disables collection/export actions during a failed refresh', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => { render(<App page="popup" />); });
    sendMock.mockRejectedValueOnce(new Error('Worker unavailable.'));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByText('Status unavailable')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Pause tracking/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Preview Wrapped card/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Tracking enabled')).toBeTruthy();
  });

  it('does not erase saved totals while showing the paused empty state', async () => {
    snapshot.days = [];
    snapshot.settings.trackingEnabled = false;
    render(<App page="popup" />);
    expect(await screen.findByText('Tracking paused')).toBeTruthy();
    expect(screen.getByText(/Existing history is kept/)).toBeTruthy();
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: 'GET_SNAPSHOT' }));
    expect(sendMock.mock.calls.some(([request]) => request.type === 'CLEAR_DATA')).toBe(false);
  });
});