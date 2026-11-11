import { test, expect, chromium, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let context: BrowserContext;
let profile: string;
let extensionId: string;
let server: Server;
let site: string;
let options: Page;
let website: Page;
const extensionPath = path.resolve('.output/chrome-mv3');

async function launch() {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
}

async function snapshot() {
  return options.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SNAPSHOT' });
    if (!response.ok) throw new Error(response.error);
    return response.data as { settings: { trackingEnabled: boolean }; days: { distancePx: number; actions: number; activeMs: number }[] };
  });
}

async function distance(): Promise<number> {
  return (await snapshot()).days.reduce((total, day) => total + day.distancePx, 0);
}

async function checkAccessibility(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

function waitForWorkerState(session: CDPSession, url: string, state: 'running' | 'stopped'): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      session.off('ServiceWorker.workerVersionUpdated', onUpdate);
      reject(new Error(`Extension worker did not reach ${state}.`));
    }, 10_000);
    function onUpdate({ versions }: { versions: { versionId: string; scriptURL: string; runningStatus: string }[] }) {
      const version = versions.find((candidate) => candidate.scriptURL === url && candidate.runningStatus === state);
      if (!version) return;
      clearTimeout(timer);
      session.off('ServiceWorker.workerVersionUpdated', onUpdate);
      resolve(version.versionId);
    }
    session.on('ServiceWorker.workerVersionUpdated', onUpdate);
  });
}

test.describe.serial('real Chrome extension', () => {
  test.beforeAll(async () => {
    profile = await mkdtemp(path.join(tmpdir(), 'scrollmiles-e2e-'));
    server = createServer((_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><head><title>Local scroll fixture</title><style>body{margin:0;height:20000px;background:linear-gradient(#e0edcc,#33442d)}#nested{position:absolute;top:50px;left:40px;width:300px;height:200px;overflow:auto}#inner{height:4000px}</style></head><body><h1>Scroll fixture</h1><div id="nested"><div id="inner">Nested scroll fixture</div></div></body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No fixture server.');
    site = `http://127.0.0.1:${address.port}`;
    await launch();
    options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    website = await context.newPage();
    await website.goto(site);
  });

  test.afterAll(async () => {
    await context?.close();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (profile) await rm(profile, { recursive: true, force: true });
  });

  test('ships no mandatory host access, static scripts, or incognito access', async () => {
    const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.content_scripts ?? []).toEqual([]);
    expect(manifest.permissions).toEqual(['storage', 'scripting']);
    expect(manifest.incognito).toBe('not_allowed');
    for (const size of [16, 32, 48, 128]) {
      const icon = await readFile(path.join(extensionPath, manifest.icons[size]));
      expect(icon.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(icon.readUInt32BE(16)).toBe(size);
      expect(icon.readUInt32BE(20)).toBe(size);
    }
    expect(await distance()).toBe(0);
    await expect(options.getByText('No websites enabled. Nothing is being tracked.')).toBeVisible();
  });

  test('keeps the bundled privacy notice offline and keyboard navigable', async () => {
    const privacy = await context.newPage();
    const externalRequests: string[] = [];
    privacy.on('request', (request) => {
      if (/^https?:/.test(request.url())) externalRequests.push(request.url());
    });
    await privacy.goto(`chrome-extension://${extensionId}/privacy.html`);
    await expect(privacy.getByRole('article', { name: 'Full privacy notice' })).toBeVisible();
    await expect(privacy.getByRole('heading', { name: '05 Retention and deletion' })).toBeVisible();
    await privacy.keyboard.press('Tab');
    await expect(privacy.getByRole('link', { name: 'Skip to privacy notice' })).toBeFocused();
    await privacy.keyboard.press('Enter');
    await expect(privacy.locator('main')).toBeFocused();
    await checkAccessibility(privacy);
    await privacy.setViewportSize({ width: 390, height: 900 });
    expect(await privacy.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    expect(externalRequests).toEqual([]);
    await privacy.screenshot({ path: 'test-results/privacy-notice.png', fullPage: true });
    await privacy.close();
  });

  test('rejects unsupported websites before Chrome access is requested', async () => {
    await options.bringToFront();
    await options.getByLabel('Website to enable').fill('chrome://settings');
    await options.getByLabel('Website to enable').press('Enter');
    await expect(options.getByRole('alert')).toContainText('http or https');
    expect((await options.evaluate(() => chrome.permissions.getAll())).origins ?? []).toEqual([]);
    await options.getByRole('button', { name: 'Dismiss error' }).click();
  });

  test('requests host access through the real onboarding form', async () => {
    // Playwright cannot click native Chrome permission bubbles. Pre-approve
    // this local host in Chrome's real extension settings; permissions.request
    // still runs in the UI and activates the optional grant. No API is mocked.
    const manager = await context.newPage();
    await manager.goto('chrome://extensions');
    await manager.evaluate(async (id) => {
      const api = chrome as typeof chrome & { developerPrivate: { addHostPermission(id: string, host: string): Promise<void> } };
      await api.developerPrivate.addHostPermission(id, 'http://127.0.0.1/*');
    }, extensionId);
    await manager.close();
    await options.bringToFront();
    await options.getByLabel('Website to enable').fill(site);
    await options.getByRole('button', { name: 'Enable website' }).click();
    await expect(options.getByText('Website enabled. Scroll there to start your journey.')).toBeVisible();
    const granted = await options.evaluate(() => chrome.permissions.getAll());
    expect(granted.origins).toContain('http://127.0.0.1/*');
    await expect(options.getByRole('button', { name: 'Remove http://127.0.0.1' })).toBeVisible();
  });

  test('counts absolute root movement and nested scrolling', async () => {
    await website.bringToFront();
    await website.evaluate(() => window.focus());
    await expect.poll(() => website.evaluate(() => document.hasFocus())).toBe(true);
    await website.evaluate(() => window.scrollTo(0, 1000));
    await expect.poll(distance).toBe(1000);
    await website.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(distance).toBe(1500);
    await website.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(distance).toBe(2000);
    await website.locator('#nested').hover();
    await website.evaluate(() => { document.getElementById('nested')!.scrollTop = 300; });
    await expect.poll(distance).toBe(2300);
  });

  test('does not count hidden-tab movement or paused movement', async () => {
    await options.bringToFront();
    await website.evaluate(() => window.scrollTo(0, 1000));
    await options.getByRole('switch', { name: 'Scroll tracking' }).click();
    await expect.poll(async () => (await snapshot()).settings.trackingEnabled).toBe(false);
    await website.bringToFront();
    await website.evaluate(() => window.scrollTo(0, 2000));
    expect(await distance()).toBe(2300);
    await options.bringToFront();
    await options.getByRole('switch', { name: 'Scroll tracking' }).click();
    await expect.poll(async () => (await snapshot()).settings.trackingEnabled).toBe(true);
    await website.bringToFront();
    await website.evaluate(() => window.scrollTo(0, 2500));
    await expect.poll(distance).toBe(2800);
  });

  test('renders real totals, exports a PNG, and supports a light theme', async () => {
    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await expect(dashboard.locator('.metric-card').filter({ hasText: 'The raw distance' }).locator('strong')).toHaveText('2,800px');
    await expect(dashboard.getByRole('heading', { name: 'Your week in motion' })).toBeVisible();
    await checkAccessibility(dashboard);
    const downloadPromise = dashboard.waitForEvent('download');
    await dashboard.getByRole('button', { name: 'Download my Wrapped' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^scrollmiles-.*\.png$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    expect((await readFile(downloadPath!)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    await dashboard.screenshot({ path: 'test-results/dashboard-dark.png', fullPage: true });
    await dashboard.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(dashboard.locator('html')).toHaveAttribute('data-theme', 'light');
    await checkAccessibility(dashboard);
    await dashboard.screenshot({ path: 'test-results/dashboard-light.png', fullPage: true });
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 390, height: 1000 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByRole('link', { name: 'Your full story' })).toBeVisible();
    await checkAccessibility(popup);
    expect(await popup.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await popup.screenshot({ path: 'test-results/popup.png', fullPage: true });
    await popup.close();
    await dashboard.close();
    await options.bringToFront();
    await checkAccessibility(options);
  });

  test('keeps totals and settings after a real browser restart', async () => {
    await context.close();
    await launch();
    options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    expect(await distance()).toBe(2800);
    await expect(options.locator('html')).toHaveAttribute('data-theme', 'light');
    website = await context.newPage();
    await website.goto(site);
    await website.bringToFront();
    await website.evaluate(() => window.focus());
    // Wait for the extension's registered script to initialize on the new page.
    await expect.poll(() => website.evaluate(() => document.hasFocus())).toBe(true);
    await website.mouse.move(900, 600);
    await website.mouse.wheel(0, 400);
    await expect.poll(distance).toBeGreaterThan(2800);
  });

  test('continues an existing tab safely after the actual service worker stops', async () => {
    const before = await distance();
    // Headless Chromium can report multiple tabs as visible. Unload the UI
    // to remove its refresh interval before explicitly stopping the worker.
    await options.goto('about:blank');
    await website.bringToFront();
    const worker = context.serviceWorkers().find((candidate) => candidate.url().endsWith('/background.js'));
    expect(worker).toBeTruthy();
    await worker!.evaluate(() => chrome.runtime.id);
    const session = await context.newCDPSession(website);
    const url = `chrome-extension://${extensionId}/background.js`;
    try {
      const running = waitForWorkerState(session, url, 'running');
      await session.send('ServiceWorker.enable');
      const versionId = await running;
      const stopped = waitForWorkerState(session, url, 'stopped');
      await session.send('ServiceWorker.stopWorker', { versionId });
      await stopped;
      const restarted = waitForWorkerState(session, url, 'running');
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      expect(await distance()).toBe(before);
      await restarted;
      await website.bringToFront();
      await website.evaluate(() => window.scrollBy(0, 250));
      await expect.poll(distance).toBe(before + 250);
      await website.evaluate(() => window.scrollBy(0, -250));
      await expect.poll(distance).toBe(before + 500);
    } finally { await session.detach(); }
  });

  test('deletes history, rejects stale checkpoints, and revokes removed hosts', async () => {
    await options.bringToFront();
    const oldSettings = await options.evaluate(async () => (await chrome.storage.local.get('settings')).settings as { epoch: string });
    await options.getByRole('button', { name: 'Delete history', exact: true }).click();
    await options.getByRole('button', { name: 'Delete & pause' }).click();
    await expect(options.getByText('All history deleted. Tracking is paused.')).toBeVisible();
    expect(await distance()).toBe(0);
    expect((await snapshot()).settings.trackingEnabled).toBe(false);
    const newSettings = await options.evaluate(async () => (await chrome.storage.local.get('settings')).settings as { epoch: string });
    expect(newSettings.epoch).not.toBe(oldSettings.epoch);
    await website.bringToFront();
    await website.evaluate(() => window.scrollTo(0, 2000));
    await options.bringToFront();
    expect(await distance()).toBe(0);
    await options.getByRole('button', { name: 'Remove http://127.0.0.1' }).click();
    await expect(options.getByText('No websites enabled. Nothing is being tracked.')).toBeVisible();
    const granted = await options.evaluate(() => chrome.permissions.getAll());
    expect(granted.origins ?? []).not.toContain('http://127.0.0.1/*');
  });
});