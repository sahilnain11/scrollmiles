// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCard, renderCard } from '../src/wrapped/CardRenderer';
import { captureWrapped, wrappedCard } from '../src/wrapped/model';

const card = wrappedCard(captureWrapped([{ date: '2026-11-11', distancePx: 5000, actions: 2, activeMs: 200 }], 'test', new Date(2026, 10, 11)), 'today');
afterEach(() => vi.restoreAllMocks());

function canvasContext() {
  const context = {
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(), beginPath: vi.fn(), ellipse: vi.fn(), stroke: vi.fn(),
    fillText: vi.fn(), measureText: (text: string) => ({ width: text.length * 80 }),
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 0,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return context;
}

describe('local PNG renderer and download separation', () => {
  it('renders the actual size/date/anonymous values and returns a blob without downloading', async () => {
    const context = canvasContext();
    const png = new Blob(['rendered'], { type: 'image/png' });
    let dimensions: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback) {
      dimensions = [this.width, this.height]; callback(png);
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(await renderCard(card)).toBe(png);
    expect(dimensions).toEqual([1200, 1200]);
    const text = context.fillText.mock.calls.map((call) => call[0]).join(' ');
    expect(text).toContain('2026');
    expect(text).toContain('<1s');
    expect(text).toContain('Estimated screen-equivalent distance');
    expect(text).not.toContain('example.com');
    expect(click).not.toHaveBeenCalled();
  });
  it('reports an unavailable canvas instead of returning a fake preview', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(renderCard(card)).rejects.toThrow('could not create the share card');
  });
  it('reports PNG encoding failure', async () => {
    canvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));
    await expect(renderCard(card)).rejects.toThrow('Could not export the image');
  });
  it('downloads the supplied preview URL and removes its temporary anchor', () => {
    let observed: { href: string; filename: string } | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      observed = { href: this.href, filename: this.download };
    });
    downloadCard('blob:actual-preview', card.filename);
    expect(observed).toEqual({ href: 'blob:actual-preview', filename: 'scrollmiles-2026-11-11.png' });
    expect(document.querySelector('a[download]')).toBeNull();
  });
});