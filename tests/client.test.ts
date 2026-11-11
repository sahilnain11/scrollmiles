import { afterEach, describe, expect, it, vi } from 'vitest';
import { RELOAD_EXTENSION_MESSAGE, send } from '../src/utils/client';

afterEach(() => vi.unstubAllGlobals());

describe('UI worker compatibility errors', () => {
  it('explains how to reload after an older worker rejects a newer request', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: false, error: 'Unknown request.' });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    await expect(send({ type: 'SET_ALL_SITES', enabled: true })).rejects.toThrow(RELOAD_EXTENSION_MESSAGE);
    expect(sendMessage).toHaveBeenCalledTimes(1); // No unsafe auto-retry or reload.
  });

  it('preserves actual permission and storage errors', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: false, error: 'All-site permission was not granted.' }) } });
    await expect(send({ type: 'SET_ALL_SITES', enabled: true })).rejects.toThrow('All-site permission was not granted.');
  });

  it('returns successful worker data without changing it', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, data: { accepted: true } }) } });
    await expect(send({ type: 'GET_SETTINGS' })).resolves.toEqual({ accepted: true });
  });
});