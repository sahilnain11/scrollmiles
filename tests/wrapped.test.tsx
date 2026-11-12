// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { captureWrapped, wrappedCard, wrappedDateLabel } from '../src/wrapped/model';
import { WrappedPreview } from '../src/components/WrappedPreview';
import { downloadCard, renderCard } from '../src/wrapped/CardRenderer';

vi.mock('../src/wrapped/CardRenderer', () => ({ renderCard: vi.fn(), downloadCard: vi.fn() }));
const renderMock = vi.mocked(renderCard);
const downloadMock = vi.mocked(downloadCard);
const captured = captureWrapped([
  { date: '2026-11-11', distancePx: 500, activeMs: 200, actions: 2 },
  { date: '2026-11-10', distancePx: 1000, activeMs: 500, actions: 3 },
], 'epoch-a', new Date(2026, 10, 11, 12));

beforeEach(() => {
  renderMock.mockReset().mockResolvedValue(new Blob(['PNG fixture'], { type: 'image/png' }));
  downloadMock.mockReset();
  let urlIndex = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:wrapped-${++urlIndex}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('site-free frozen Wrapped model', () => {
  it('projects only anonymous fields and does not retain references to storage objects', () => {
    const row = { date: '2026-11-11', distancePx: 50, actions: 1, activeMs: 0, site: 'https://private.example', fullUrl: 'https://private.example/path?q=secret' };
    const result = captureWrapped([row], 'test', new Date(2026, 10, 11));
    row.distancePx = 9999;
    expect(result.today.distancePx).toBe(50);
    expect(Object.keys(result.today).sort()).toEqual(['actions', 'activeMs', 'date', 'distancePx']);
    expect(JSON.stringify(wrappedCard(result, 'week'))).not.toMatch(/private|secret|epoch/);
  });
  it('uses exact daily/seven-day totals and local dates without inventing absent days', () => {
    expect(wrappedCard(captured, 'today').stats).toEqual({ date: '2026-11-11', distancePx: 500, actions: 2, activeMs: 200 });
    expect(wrappedCard(captured, 'week').stats).toEqual({ date: 'week', distancePx: 1500, actions: 5, activeMs: 700 });
    expect(wrappedCard(captured, 'week').startDate).toBe('2026-11-05');
    expect(wrappedCard(captured, 'week').filename).toBe('scrollmiles-week.png');
    expect(wrappedDateLabel(wrappedCard(captured, 'today'))).toContain('2026');
    expect(wrappedCard(captureWrapped([], 'test', new Date(2026, 10, 11)), 'today').stats.distancePx).toBe(0);
  });
});

describe('actual-PNG preview lifecycle', () => {
  function show(overrides: Partial<Parameters<typeof WrappedPreview>[0]> = {}) {
    const props = { snapshot: captured, initialPeriod: 'today' as const, unavailable: false, onClose: vi.fn(), onRefresh: vi.fn(), ...overrides };
    return { ...render(<WrappedPreview {...props} />), props };
  }

  it('does not download on open and saves the already-rendered image URL on confirmation', async () => {
    show();
    const image = await screen.findByRole('img', { name: /Wrapped PNG preview/ });
    expect(downloadMock).not.toHaveBeenCalled();
    expect(renderMock).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download PNG' }));
    expect(downloadMock).toHaveBeenCalledWith(image.getAttribute('src'), 'scrollmiles-2026-11-11.png');
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it('switches periods explicitly and does not reuse an old period image', async () => {
    show();
    const user = userEvent.setup();
    const before = (await screen.findByRole('img', { name: /Wrapped PNG preview/ })).getAttribute('src');
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() => expect(renderMock).toHaveBeenCalledWith(wrappedCard(captured, 'week')));
    expect((await screen.findByRole('img', { name: /Wrapped PNG preview/ })).getAttribute('src')).not.toBe(before);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(before);
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));
    expect(downloadMock.mock.calls[0]?.[1]).toBe('scrollmiles-week.png');
  });

  it('keeps failure honest, disables download, and allows retry', async () => {
    renderMock.mockRejectedValueOnce(new Error('Canvas failed.'));
    show();
    expect((await screen.findByRole('alert')).textContent).toContain('Canvas failed.');
    expect(screen.queryByRole('img')).toBeNull();
    expect((screen.getByRole('button', { name: 'Download PNG' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry preview' }));
    await screen.findByRole('img', { name: /Wrapped PNG preview/ });
    expect((screen.getByRole('button', { name: 'Download PNG' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('ignores a stale render completion after period selection changes', async () => {
    let finishOld!: (value: Blob) => void;
    renderMock.mockReturnValueOnce(new Promise<Blob>((resolve) => { finishOld = resolve; }));
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Last 7 days' }));
    const current = await screen.findByRole('img', { name: /Wrapped PNG preview/ });
    const src = current.getAttribute('src');
    await act(async () => { finishOld(new Blob(['old period'])); });
    expect(screen.getByRole('img').getAttribute('src')).toBe(src);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('releases the preview resource on unmount and never downloads automatically', async () => {
    const { unmount } = show();
    const image = await screen.findByRole('img');
    const url = image.getAttribute('src');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('blocks stale-data export and refresh without hiding the older preview', async () => {
    const { props } = show({ unavailable: true });
    await screen.findByRole('img');
    expect((screen.getByRole('button', { name: 'Download PNG' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Refresh preview totals' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('statistics could not be verified');
    expect(props.onRefresh).not.toHaveBeenCalled();
  });

  it('forwards explicit refresh and dismissal without mutating totals', async () => {
    const { props } = show();
    await screen.findByRole('img');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh preview totals' }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(renderMock.mock.calls[0]?.[0].stats.distancePx).toBe(500);
  });
});