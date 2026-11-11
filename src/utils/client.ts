import type { Request, Response } from '../types';

export const RELOAD_EXTENSION_MESSAGE = 'The ScrollMiles page and background worker may be from different builds. Open chrome://extensions, click Reload on ScrollMiles, close old ScrollMiles tabs, and reopen it from the toolbar. Do not remove the extension; reloading preserves saved data.';

export async function send<T = null>(request: Request): Promise<T> {
  const response = await chrome.runtime.sendMessage(request) as Response<T>;
  if (response?.ok === false && response.error === 'Unknown request.') throw new Error(RELOAD_EXTENSION_MESSAGE);
  if (!response?.ok) throw new Error(response?.error ?? 'ScrollMiles is unavailable. Try reopening the extension.');
  return response.data;
}