// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/components/App';
import { PrivacyPage } from '../src/components/PrivacyPage';
import { localDate } from '../src/analytics/metrics';
import { send } from '../src/utils/client';
import type { Snapshot } from '../src/types';

vi.mock('../src/utils/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/utils/client')>(), send: vi.fn(),
}));
const sendMock = vi.mocked(send);
const permission = vi.fn<(options: chrome.permissions.Permissions) => Promise<boolean>>();
const snapshot: Snapshot = {
  settings: { trackingEnabled: true, approvedSites: [], allSitesEnabled: false, excludedSites: [], siteInsightsEnabled: false, siteInsightsSince: null, epoch: 'test-epoch', theme: 'dark' },
  days: [],
  capabilities: { allSiteAccess: true, siteInsights: true },
};

beforeEach(() => {
  sendMock.mockReset().mockResolvedValue(structuredClone(snapshot));
  permission.mockReset().mockResolvedValue(true);
  vi.stubGlobal('chrome', {
    runtime: { id: 'scrollmiles-test' },
    permissions: { request: permission },
    storage: { local: { get: vi.fn().mockResolvedValue({ settings: snapshot.settings }) } },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function submitWebsite() {
  const user = userEvent.setup();
  await user.type(await screen.findByRole('textbox', { name: 'Website to enable' }), 'https://example.com/private?q=secret');
  await user.click(screen.getByRole('button', { name: 'Enable website' }));
}

describe('permission UI', () => {
  it('requires informed insights consent without requesting a new Chrome permission', async () => {
    render(<App page="options" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Set up website insights' }));
    expect(screen.getByRole('group', { name: 'Confirm website insights' }).textContent).toContain('exact scheme/hostnames');
    expect(sendMock.mock.calls.some(([request]) => request.type === 'SET_SITE_INSIGHTS')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Enable website insights' }));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: 'SET_SITE_INSIGHTS', enabled: true }));
    expect(permission).not.toHaveBeenCalled();
  });

  it('can cancel detailed history opt-in', async () => {
    render(<App page="options" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Set up website insights' }));
    await user.click(screen.getByRole('button', { name: 'Keep anonymous totals only' }));
    expect(screen.queryByRole('group', { name: 'Confirm website insights' })).toBeNull();
    expect(sendMock.mock.calls.some(([request]) => request.type === 'SET_SITE_INSIGHTS')).toBe(false);
  });

  it('does not pretend anonymous history can be split when insights are off', async () => {
    render(<App page="dashboard" />);
    expect(await screen.findByText('Anonymous until you choose otherwise.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Choose a website to analyze' })).toBeNull();
  });

  it('does not request new all-site access from a stale background worker', async () => {
    sendMock.mockResolvedValue({ ...snapshot, capabilities: undefined });
    render(<App page="options" />);
    expect((await screen.findByRole('alert')).textContent).toContain('click Reload on ScrollMiles');
    expect(screen.queryByRole('button', { name: 'Set up all-site access' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Allow all supported websites' })).toBeNull();
    expect(permission).not.toHaveBeenCalled();
  });

  it('requires an extra explicit choice before requesting all-site permission', async () => {
    render(<App page="options" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Set up all-site access' }));
    expect(permission).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Confirm all-site access' }).textContent).toContain('sensitive sites');
    await user.click(screen.getByRole('button', { name: 'Allow all supported websites' }));
    expect(permission).toHaveBeenCalledWith({ origins: ['https://*/*', 'http://*/*'] });
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: 'SET_ALL_SITES', enabled: true }));
  });

  it('leaves selected-site policy unchanged when broad access is declined', async () => {
    permission.mockResolvedValue(false);
    render(<App page="options" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Set up all-site access' }));
    await user.click(screen.getByRole('button', { name: 'Allow all supported websites' }));
    expect((await screen.findByRole('alert')).textContent).toContain('existing website choices are unchanged');
    expect(sendMock.mock.calls.some(([request]) => request.type === 'SET_ALL_SITES')).toBe(false);
  });

  it('can cancel all-site setup without requesting permission', async () => {
    render(<App page="options" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Set up all-site access' }));
    await user.click(screen.getByRole('button', { name: 'Keep selected websites' }));
    expect(permission).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Confirm all-site access' })).toBeNull();
  });

  it('adds exclusions in broad mode without asking for another permission', async () => {
    sendMock.mockResolvedValue({ ...snapshot, settings: { ...snapshot.settings, allSitesEnabled: true } });
    render(<App page="options" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Website to exclude' }), 'https://bank.example/private');
    await user.click(screen.getByRole('button', { name: 'Exclude website' }));
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: 'EXCLUDE_SITE', site: 'https://bank.example' }));
    expect(permission).not.toHaveBeenCalled();
  });

  it('handles a declined request without approving or counting a website', async () => {
    permission.mockResolvedValue(false);
    render(<App page="options" />);
    await submitWebsite();
    expect((await screen.findByRole('alert')).textContent).toContain('Permission was not granted. Nothing will be tracked');
    expect(permission).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });
    expect(sendMock.mock.calls.some(([request]) => request.type === 'ADD_SITE')).toBe(false);
    expect(screen.getByText('No websites enabled. Nothing is being tracked.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enable website' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows Chrome API rejection and permits another attempt', async () => {
    permission.mockRejectedValueOnce(new Error('Website access is blocked by your administrator.'));
    render(<App page="options" />);
    await submitWebsite();
    expect((await screen.findByRole('alert')).textContent).toContain('blocked by your administrator');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable website' }));
    expect((await screen.findByRole('status')).textContent).toContain('Website enabled.');
    expect(permission).toHaveBeenCalledTimes(2);
  });

  it('handles synchronous API exceptions without a stuck busy state', async () => {
    permission.mockImplementation(() => { throw new Error('Chrome could not open the permission request.'); });
    render(<App page="options" />);
    await submitWebsite();
    expect((await screen.findByRole('alert')).textContent).toContain('could not open the permission request');
    expect((screen.getByRole('button', { name: 'Enable website' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('requests permission during the submit gesture and sends only the normalized host', async () => {
    render(<App page="options" />);
    const input = await screen.findByRole('textbox', { name: 'Website to enable' });
    fireEvent.change(input, { target: { value: 'https://example.com/private?q=secret' } });
    fireEvent.submit(input.closest('form')!);
    expect(permission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith({ type: 'ADD_SITE', site: 'https://example.com' }));
    expect(JSON.stringify(sendMock.mock.calls)).not.toContain('secret');
  });

  it('rejects unsupported input before requesting access', async () => {
    render(<App page="options" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Website to enable' }), 'chrome://settings');
    await user.click(screen.getByRole('button', { name: 'Enable website' }));
    expect((await screen.findByRole('alert')).textContent).toContain('http or https');
    expect(permission).not.toHaveBeenCalled();
  });
});

describe('honest loading and recovery', () => {
  it('does not present a storage failure as zero activity and recovers on retry', async () => {
    sendMock.mockRejectedValueOnce(new Error('Local database could not be opened.'));
    render(<App page="dashboard" />);
    expect((await screen.findByRole('alert')).textContent).toContain('statistics could not be loaded');
    expect(screen.queryByText('Scroll bursts')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Preview my Wrapped' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Read the privacy notice' })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry loading' }));
    expect(await screen.findByText('Scroll bursts')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns when refresh fails instead of silently showing stale totals', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => { render(<App page="dashboard" />); });
    expect(screen.getByText('Scroll bursts')).toBeTruthy();
    sendMock.mockRejectedValueOnce(new Error('The extension worker is unavailable.'));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByRole('alert').textContent).toContain('These totals may be out of date.');
    expect(screen.getByText('Scroll bursts')).toBeTruthy();
    sendMock.mockResolvedValue(structuredClone(snapshot));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.queryByRole('alert')).toBeNull();
    vi.restoreAllMocks();
  });

  it('exposes the selected period to assistive technology', async () => {
    render(<App page="popup" />);
    const today = await screen.findByRole('button', { name: 'Today' });
    const week = screen.getByRole('button', { name: 'Last 7 days' });
    expect(today.getAttribute('aria-pressed')).toBe('true');
    await userEvent.setup().click(week);
    expect(week.getAttribute('aria-pressed')).toBe('true');
    expect(today.getAttribute('aria-pressed')).toBe('false');
  });

  it('preserves actual measurements after a failed action', async () => {
    sendMock.mockResolvedValue({ ...snapshot, settings: { ...snapshot.settings, approvedSites: ['https://example.com'] }, days: [{ date: localDate(), distancePx: 500, actions: 2, activeMs: 200 }] });
    render(<App page="dashboard" />);
    await screen.findByText('Scroll bursts');
    sendMock.mockRejectedValueOnce(new Error('Pause could not be saved.'));
    await userEvent.setup().click(screen.getByRole('button', { name: /Pause tracking/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Pause could not be saved.');
    expect(screen.getByText('2', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pause tracking/ })).toBeTruthy();
  });
});

describe('offline privacy notice', () => {
  it('remains readable in a regular browser without Chrome extension APIs', async () => {
    vi.stubGlobal('chrome', undefined);
    render(<PrivacyPage />);
    await act(async () => undefined);
    expect(screen.getByRole('article', { name: 'Full privacy notice' })).toBeTruthy();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('also works when a browser exposes chrome but no extension storage', async () => {
    vi.stubGlobal('chrome', {});
    render(<PrivacyPage />);
    await act(async () => undefined);
    expect(screen.getByRole('heading', { name: /Retention and deletion/ })).toBeTruthy();
  });

  it('does not depend on worker/database availability', async () => {
    sendMock.mockRejectedValue(new Error('Database unavailable.'));
    render(<PrivacyPage />);
    expect(screen.getByRole('article', { name: 'Full privacy notice' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Retention and deletion/ })).toBeTruthy();
    expect(sendMock).not.toHaveBeenCalled();
    await act(async () => undefined);
  });
});