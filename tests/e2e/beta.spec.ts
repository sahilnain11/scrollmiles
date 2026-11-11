import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { test, expect, scrollTo } from './beta-fixture';
import { STATS_DB_VERSION } from '../../src/storage/database';

test('exact-host access excludes www and the reverse', async ({ beta }) => {
  await beta.enable();
  const www = await beta.open(beta.site.replace('scrollmiles.test', 'www.scrollmiles.test'));
  await scrollTo(www, 900);
  const apex = await beta.open();
  await scrollTo(apex, 400);
  await expect.poll(beta.distance).toBe(400);
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Remove http://scrollmiles.test' }).click();
  await expect(beta.options.getByText('No websites enabled. Nothing is being tracked.')).toBeVisible();
  await beta.enable('www.scrollmiles.test');
  await apex.bringToFront();
  await scrollTo(apex, 1500);
  await www.bringToFront();
  await scrollTo(www, 1200);
  await expect.poll(beta.distance).toBe(700);
});

test('all-site opt-in includes multiple hosts and honors exclusions on existing tabs', async ({ beta }, testInfo) => {
  expect((await beta.snapshot()).settings.allSitesEnabled).toBe(false);
  await beta.enableAll();
  const accessAudit = await new AxeBuilder({ page: beta.options }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessAudit.violations.map(({ id }) => id)).toEqual([]);
  await beta.options.screenshot({ path: testInfo.outputPath('all-site-settings.png'), fullPage: true });
  const first = await beta.open();
  await scrollTo(first, 400);
  await expect.poll(beta.distance).toBe(400);
  const second = await beta.open(beta.site.replace('scrollmiles.test', 'www.scrollmiles.test'));
  await scrollTo(second, 300);
  await expect.poll(beta.distance).toBe(700);
  await beta.options.bringToFront();
  await beta.options.getByRole('textbox', { name: 'Website to exclude' }).fill('http://scrollmiles.test');
  await beta.options.getByRole('button', { name: 'Exclude website' }).click();
  await expect(beta.options.getByRole('button', { name: 'Stop excluding http://scrollmiles.test' })).toBeVisible();
  await first.bringToFront();
  await scrollTo(first, 1300);
  await second.bringToFront();
  await scrollTo(second, 500);
  await expect.poll(beta.distance).toBe(900);
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Stop excluding http://scrollmiles.test' }).click();
  await expect.poll(async () => (await beta.snapshot()).settings.excludedSites.length).toBe(0);
  await first.bringToFront();
  await scrollTo(first, 1500);
  await expect.poll(beta.distance).toBe(1100);
  await beta.options.reload();
  await expect(beta.options.getByRole('button', { name: 'Turn off all-site access' })).toBeVisible();
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Turn off all-site access' }).click();
  await expect(beta.options.getByText('All-site access revoked. No websites are enabled.')).toBeVisible();
  expect((await beta.options.evaluate(() => chrome.permissions.getAll())).origins ?? []).toEqual([]);
  await second.bringToFront();
  await scrollTo(second, 1500);
  await beta.enable();
  await first.bringToFront();
  await scrollTo(first, 1700);
  await expect.poll(beta.distance).toBe(1300);
});

test('infinite-feed growth and SPA navigation preserve totals without saving URLs', async ({ beta }) => {
  await beta.enable();
  const page = await beta.open();
  await scrollTo(page, 1000);
  await expect.poll(beta.distance).toBe(1000);
  await page.evaluate(() => {
    const more = document.createElement('section');
    more.style.height = '40000px';
    document.body.append(more);
    window.history.pushState({}, '', '/feed/next?query=fixture-secret#second');
  });
  await scrollTo(page, 1700);
  await expect.poll(beta.distance).toBe(1700);
  await scrollTo(page, 1200);
  await expect.poll(beta.distance).toBe(2200);
  const history = await beta.options.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('scrollmiles');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const records = await Promise.all(['days', 'checkpoints'].map((name) => new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      })));
      return JSON.stringify(records);
    } finally { db.close(); }
  });
  for (const forbidden of ['fixture-secret', 'scrollmiles.test', '/feed/next']) expect(history).not.toContain(forbidden);
});

test('wheel and keyboard scrolling work in root and resized nested panels', async ({ beta }) => {
  await beta.enable();
  const page = await beta.open();
  await page.mouse.move(900, 600);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
  await expect.poll(beta.distance).toBe(500);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  const rootY = await page.evaluate(() => window.scrollY);
  await expect.poll(beta.distance).toBe(rootY);
  await scrollTo(page, 0);
  await expect.poll(beta.distance).toBe(rootY * 2);
  await page.locator('#panel').hover();
  await page.mouse.wheel(0, 350);
  await expect.poll(() => page.locator('#panel').evaluate((element) => element.scrollTop)).toBe(350);
  await expect.poll(beta.distance).toBe(rootY * 2 + 350);
  await page.locator('#panel').evaluate((element) => { (element as HTMLElement).style.height = '320px'; });
  await page.mouse.wheel(0, 150);
  await expect.poll(() => page.locator('#panel').evaluate((element) => element.scrollTop)).toBe(500);
  await expect.poll(beta.distance).toBe(rootY * 2 + 500);
});

test('reload and navigation back do not reset or duplicate totals', async ({ beta }) => {
  await beta.enable();
  const page = await beta.open();
  await scrollTo(page, 600);
  await expect.poll(beta.distance).toBe(600);
  await page.reload();
  const baseline = await page.evaluate(() => window.scrollY);
  await scrollTo(page, baseline + 200);
  await expect.poll(beta.distance).toBe(800);
  await page.goto('about:blank');
  await page.goto(beta.site);
  await scrollTo(page, 300);
  await expect.poll(beta.distance).toBe(1100);
});

test('pause and resume apply across two actual Chrome windows', async ({ beta }) => {
  await beta.enable();
  const first = await beta.open();
  await scrollTo(first, 400);
  await expect.poll(beta.distance).toBe(400);
  const windowId = await beta.options.evaluate(async (url) => {
    const created = await chrome.windows.create({ url, focused: true, type: 'normal' });
    if (created?.id === undefined) throw new Error('Chrome did not create a test window.');
    return created.id;
  }, `${beta.site}/other-window`);
  await expect.poll(() => beta.context.pages().find((page) => page.url().includes('/other-window'))?.url()).toBe(`${beta.site}/other-window`);
  const second = beta.context.pages().find((page) => page.url().includes('/other-window'))!;
  await second.waitForLoadState();
  await second.bringToFront();
  await scrollTo(second, 700);
  await expect.poll(beta.distance).toBe(1100);
  await beta.options.bringToFront();
  await beta.options.getByRole('switch', { name: 'Scroll tracking' }).click();
  await expect.poll(async () => (await beta.snapshot()).settings.trackingEnabled).toBe(false);
  await second.bringToFront();
  await scrollTo(second, 1600);
  await beta.options.bringToFront();
  await beta.options.getByRole('switch', { name: 'Scroll tracking' }).click();
  await expect.poll(async () => (await beta.snapshot()).settings.trackingEnabled).toBe(true);
  await second.bringToFront();
  await scrollTo(second, 1800);
  await expect.poll(beta.distance).toBe(1300);
  await beta.options.evaluate((id) => chrome.windows.remove(id), windowId);
});

test('website removal stops an existing collector and preserves history', async ({ beta }) => {
  await beta.enable();
  const page = await beta.open();
  await scrollTo(page, 450);
  await expect.poll(beta.distance).toBe(450);
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Remove http://scrollmiles.test' }).click();
  await expect(beta.options.getByText('Website removed and its permission revoked.')).toBeVisible();
  await page.bringToFront();
  await scrollTo(page, 1450);
  await beta.options.bringToFront();
  expect((await beta.options.evaluate(() => chrome.permissions.getAll())).origins ?? []).toEqual([]);
  expect(await beta.distance()).toBe(450);
  await beta.enable();
  await page.bringToFront();
  await scrollTo(page, 1650);
  await expect.poll(beta.distance).toBe(650);
});

test('cancelled deletion preserves history; confirmed deletion leaves exported PNG intact', async ({ beta }, testInfo) => {
  await beta.enable();
  const page = await beta.open();
  await scrollTo(page, 650);
  await expect.poll(beta.distance).toBe(650);
  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html`);
  await expect(dashboard.getByRole('button', { name: 'Download my Wrapped' })).toBeEnabled();
  const pending = dashboard.waitForEvent('download');
  await dashboard.getByRole('button', { name: 'Download my Wrapped' }).click();
  const download = await pending;
  const image = testInfo.outputPath('wrapped-local-fixture.png');
  await download.saveAs(image);
  const png = await readFile(image);
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(1200);
  await testInfo.attach('Local fixture Wrapped — not user activity', { path: image, contentType: 'image/png' });
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Delete history', exact: true }).click();
  await beta.options.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await beta.distance()).toBe(650);
  await beta.options.getByRole('button', { name: 'Delete history', exact: true }).click();
  await beta.options.getByRole('button', { name: 'Delete & pause' }).click();
  await expect(beta.options.getByRole('status')).toContainText('All history deleted');
  expect(await beta.distance()).toBe(0);
  expect((await beta.snapshot()).settings.trackingEnabled).toBe(false);
  expect(await readFile(image)).toEqual(png);
});

test('200% browser zoom preserves CSS pixels and usable keyboard navigation', async ({ beta }, testInfo) => {
  await beta.enable();
  const page = await beta.open();
  const tabId = await beta.options.evaluate(async () => (await chrome.tabs.query({})).find((tab) => tab.url?.startsWith('http://scrollmiles.test:'))!.id!);
  await beta.options.evaluate((id) => chrome.tabs.setZoom(id, 2), tabId);
  expect(await beta.options.evaluate((id) => chrome.tabs.getZoom(id), tabId)).toBe(2);
  await page.bringToFront();
  await scrollTo(page, 500);
  await expect.poll(beta.distance).toBe(500);
  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html`);
  const dashboardId = await dashboard.evaluate(async () => (await chrome.tabs.getCurrent())!.id!);
  await dashboard.evaluate((id) => chrome.tabs.setZoom(id, 2), dashboardId);
  await expect(dashboard.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
  await dashboard.keyboard.press('Tab');
  await expect(dashboard.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await dashboard.keyboard.press('Enter');
  await expect(dashboard.locator('main')).toBeFocused();
  await dashboard.getByRole('button', { name: 'Last 7 days', exact: true }).focus();
  await dashboard.keyboard.press('Enter');
  await expect(dashboard.getByRole('button', { name: 'Last 7 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dashboard.locator('summary').focus();
  await dashboard.keyboard.press('Enter');
  await expect(dashboard.getByRole('table')).toBeVisible();
  const audit = await new AxeBuilder({ page: dashboard }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(audit.violations.map(({ id }) => id)).toEqual([]);
  expect(await dashboard.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await dashboard.evaluate(() => document.querySelector('.app')!.getBoundingClientRect().right <= innerWidth)).toBe(true);
  // Full-page screenshot capture can reset emulated viewport metrics under
  // native Chrome zoom and crop the result. Capture the actual viewport.
  await dashboard.evaluate(() => window.scrollTo(0, 0));
  await dashboard.screenshot({ path: testInfo.outputPath('dashboard-200-percent.png') });
});

test('iframe scrolling stays excluded while top-level scrolling continues', async ({ beta }) => {
  await beta.enable();
  const page = await beta.open();
  const frame = page.frames().find((candidate) => candidate.url().endsWith('/frame'))!;
  await frame.waitForLoadState();
  await frame.evaluate(() => window.scrollTo(0, 1000));
  await page.mouse.click(1000, 700);
  await scrollTo(page, 200);
  await expect.poll(beta.distance).toBe(200);
});

test('real unavailable database is not shown as zero, and retry recovers in the disposable profile', async ({ beta }) => {
  // This fault is confined to this test's temporary profile, not user data.
  await beta.options.goto(`chrome-extension://${beta.extensionId}/privacy.html`);
  await beta.stopWorker();
  await beta.options.evaluate(async (version) => {
    await new Promise<void>((resolve, reject) => {
      // Simulate an incompatible/newer DB left by another version of the app.
      const request = indexedDB.open('scrollmiles', version + 1);
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Test database is still open.'));
    });
  }, STATS_DB_VERSION);
  await beta.options.goto(`chrome-extension://${beta.extensionId}/dashboard.html`);
  await expect(beta.options.getByRole('alert')).toContainText('statistics could not be loaded');
  await expect(beta.options.getByText('Scroll bursts', { exact: true })).toHaveCount(0);
  await expect(beta.options.getByRole('button', { name: 'Download my Wrapped' })).toHaveCount(0);
  const privacy = await beta.context.newPage();
  await privacy.goto(`chrome-extension://${beta.extensionId}/privacy.html`);
  await expect(privacy.getByRole('article', { name: 'Full privacy notice' })).toBeVisible();
  await beta.options.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('scrollmiles');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Faulted database is still open.'));
    });
  });
  await beta.options.getByRole('button', { name: 'Retry loading' }).click();
  await expect(beta.options.getByText('Scroll bursts', { exact: true })).toBeVisible();
  await expect(beta.options.getByRole('alert')).toHaveCount(0);
});