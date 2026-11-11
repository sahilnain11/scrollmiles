import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Snapshot } from '../../src/types';

interface BetaFixture {
  context: BrowserContext;
  options: Page;
  extensionId: string;
  site: string;
  enable(host?: string): Promise<void>;
  enableAll(): Promise<void>;
  open(url?: string): Promise<Page>;
  stopWorker(): Promise<void>;
  snapshot(): Promise<Snapshot>;
  distance(): Promise<number>;
}

function html(frame: boolean): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Local beta fixture</title><style>
  html{scroll-behavior:auto;overflow-anchor:none}body{margin:0;min-height:30000px;font:16px system-ui;background:linear-gradient(#e9f2d5,#374c2b)}
  #panel{position:absolute;top:80px;left:40px;width:300px;height:220px;overflow:auto;background:white}#panel-content{height:6000px}
  iframe{position:absolute;top:400px;left:40px;width:350px;height:200px}
  </style></head><body><h1>Local beta fixture — not user activity</h1><div id="panel" tabindex="0" aria-label="Scrollable fixture panel"><div id="panel-content">Nested scrolling</div></div>${frame ? '' : '<iframe src="/frame" title="Excluded frame fixture"></iframe>'}</body></html>`;
}

export const test = base.extend<{ beta: BetaFixture }>({
  beta: async ({}, use, testInfo) => {
    const profile = await mkdtemp(path.join(tmpdir(), 'scrollmiles-beta-'));
    const server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(html(request.url?.startsWith('/frame') ?? false));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No local fixture port.');
    const site = `http://scrollmiles.test:${address.port}`;
    const extension = path.resolve('.output/chrome-mv3');
    let context: BrowserContext | undefined;
    try {
      context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
        args: [
          `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
          '--host-resolver-rules=MAP scrollmiles.test 127.0.0.1, MAP *.scrollmiles.test 127.0.0.1',
          '--no-proxy-server', '--disable-smooth-scrolling',
        ],
      });
      const browser = context;
      const externalRequests: string[] = [];
      await browser.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (['http:', 'https:'].includes(url.protocol) && url.hostname !== 'scrollmiles.test' && !url.hostname.endsWith('.scrollmiles.test')) {
          externalRequests.push(url.href);
          await route.abort();
        } else await route.continue();
      });
      const worker = browser.serviceWorkers()[0] ?? await browser.waitForEvent('serviceworker');
      const extensionId = new URL(worker.url()).host;
      const options = await browser.newPage();
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(options.getByRole('switch', { name: 'Scroll tracking' })).toBeEnabled();
      const snapshot = () => options.evaluate(async () => {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SNAPSHOT' });
        if (!response.ok) throw new Error(response.error);
        return response.data as Snapshot;
      });
      async function preApprove(origins: string[]) {
        // Chrome settings pre-approval only. The actual UI permissions.request
        // still executes. Native browser permission bubbles remain manual.
        const manager = await browser.newPage();
        await manager.goto('chrome://extensions');
        await manager.evaluate(async ({ id, origins }) => {
          const api = chrome as typeof chrome & { developerPrivate: { addHostPermission(id: string, host: string): Promise<void> } };
          for (const host of origins) await api.developerPrivate.addHostPermission(id, host);
        }, { id: extensionId, origins });
        await manager.close();
      }
      const fixture: BetaFixture = {
        context: browser, options, extensionId, site, snapshot,
        distance: async () => (await snapshot()).days.reduce((total, day) => total + day.distancePx, 0),
        async enable(host = 'scrollmiles.test') {
          await preApprove([`http://${host}/*`]);
          await options.bringToFront();
          await options.getByRole('textbox', { name: 'Website to enable' }).fill(`http://${host}`);
          await options.getByRole('button', { name: 'Enable website' }).click();
          await expect(options.getByRole('button', { name: `Remove http://${host}` })).toBeVisible();
        },
        async enableAll() {
          await preApprove(['https://*/*', 'http://*/*']);
          await options.bringToFront();
          await options.getByRole('button', { name: 'Set up all-site access' }).click();
          await options.getByRole('button', { name: 'Allow all supported websites' }).click();
          await expect(options.getByRole('button', { name: 'Turn off all-site access' })).toBeVisible();
        },
        async open(url = site) {
          const page = await browser.newPage();
          await page.goto(url);
          await page.bringToFront();
          await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
          return page;
        },
        async stopWorker() {
          // Call only with UI polling unloaded (e.g. options on privacy.html).
          const worker = browser.serviceWorkers().find((candidate) => candidate.url().endsWith('/background.js'));
          if (!worker) throw new Error('No extension worker to stop.');
          const workerUrl = worker.url();
          await worker.evaluate(() => chrome.runtime.id);
          const session = await browser.newCDPSession(options);
          const wait = (state: string) => new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => { session.off('ServiceWorker.workerVersionUpdated', listener); reject(new Error(`Worker did not reach ${state}.`)); }, 10_000);
            function listener({ versions }: { versions: { versionId: string; scriptURL: string; runningStatus: string }[] }) {
              const found = versions.find((candidate) => candidate.scriptURL === workerUrl && candidate.runningStatus === state);
              if (!found) return;
              clearTimeout(timeout);
              session.off('ServiceWorker.workerVersionUpdated', listener);
              resolve(found.versionId);
            }
            session.on('ServiceWorker.workerVersionUpdated', listener);
          });
          try {
            const running = wait('running');
            await session.send('ServiceWorker.enable');
            const id = await running;
            const stopped = wait('stopped');
            await session.send('ServiceWorker.stopWorker', { versionId: id });
            await stopped;
          } finally { await session.detach(); }
        },
      };
      await testInfo.attach('environment', {
        body: JSON.stringify({ browser: browser.browser()?.version(), platform: process.platform, arch: process.arch, mode: 'headless production extension; local fixtures only' }, null, 2),
        contentType: 'application/json',
      });
      await use(fixture);
      expect(externalRequests, 'No off-fixture page/worker HTTP requests may be attempted.').toEqual([]);
    } finally {
      await context?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(profile, { recursive: true, force: true });
    }
  },
});

export { expect };

export async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate(async (top) => {
    window.scrollTo(0, top);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, y);
}