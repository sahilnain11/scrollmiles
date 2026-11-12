import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect, scrollTo } from './beta-fixture';

test('Wrapped previews the exact PNG, freezes totals until refresh, and supports period choice and dismissal', async ({ beta }, testInfo) => {
  await beta.enable();
  const website = await beta.open();
  await scrollTo(website, 1200);
  await expect.poll(beta.distance).toBe(1200);
  const dashboard = await beta.context.newPage();
  // Test-only observation of the real generated Blob. Chrome does not expose
  // blob-image responses consistently, and production connect-src forbids fetch.
  // Delegate URL creation unchanged; never replace the renderer or totals.
  await dashboard.addInitScript(() => {
    const observed = {} as Record<string, Promise<number[]>>;
    (globalThis as typeof globalThis & { __wrappedTestPng: typeof observed }).__wrappedTestPng = observed;
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      const url = original(blob);
      if (blob instanceof Blob && blob.type === 'image/png') observed[url] = blob.arrayBuffer().then((buffer) => [...new Uint8Array(buffer)]);
      return url;
    };
  });
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html`);
  let downloads = 0;
  dashboard.on('download', () => { downloads += 1; });
  await expect(dashboard.getByRole('heading', { name: 'Your day, in scrolling.' })).toBeVisible();
  await dashboard.getByRole('button', { name: 'Preview my Wrapped' }).click();
  const dialog = dashboard.getByRole('dialog', { name: 'Your Wrapped preview' });
  await expect(dialog).toBeVisible();
  const image = dialog.getByRole('img', { name: /Wrapped PNG preview/ });
  await expect(image).toBeVisible();
  const displayedPng = Buffer.from(await dashboard.evaluate(async (src) => {
    const observed = (globalThis as typeof globalThis & { __wrappedTestPng: Record<string, Promise<number[]>> }).__wrappedTestPng;
    return await observed[src!]!;
  }, await image.getAttribute('src')));
  expect(displayedPng.readUInt32BE(16)).toBe(1200);
  expect(displayedPng.readUInt32BE(20)).toBe(1200);
  const originalSrc = await image.getAttribute('src');
  expect(downloads).toBe(0);
  await expect(dialog.getByRole('button', { name: 'Close Wrapped preview' })).toBeFocused();
  // The native modal must contain keyboard focus when cycling backwards.
  await dashboard.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  await website.bringToFront();
  await scrollTo(website, 2400);
  await expect.poll(beta.distance).toBe(2400);
  await dashboard.bringToFront();
  await expect(dashboard.locator('.overview-metrics .metric-card').filter({ hasText: 'The raw distance' }).locator('strong')).toHaveText('2,400px');
  await expect(image).toHaveAttribute('src', originalSrc!);

  const pending = dashboard.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  const downloaded = await pending;
  const bytes = await readFile((await downloaded.path())!);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(createHash('sha256').update(displayedPng).digest('hex'));
  expect(bytes).toEqual(displayedPng);
  expect(downloads).toBe(1);

  await dialog.getByRole('button', { name: 'Refresh preview totals' }).click();
  await expect(image).not.toHaveAttribute('src', originalSrc!);
  const refreshedSrc = await image.getAttribute('src');
  await dialog.getByRole('button', { name: 'Last 7 days', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Last 7 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(image).not.toHaveAttribute('src', refreshedSrc!);
  const weekly = dashboard.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  expect((await weekly).suggestedFilename()).toBe('scrollmiles-week.png');
  const audit = await new AxeBuilder({ page: dashboard }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  await dialog.screenshot({ path: testInfo.outputPath('wrapped-preview-dark.png') });
  await dashboard.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(dashboard.getByRole('button', { name: 'Preview my Wrapped' })).toBeFocused();
  await dashboard.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(dashboard.locator('html')).toHaveAttribute('data-theme', 'light');
  await dashboard.getByRole('button', { name: 'Preview my Wrapped' }).click();
  await expect(dialog.getByRole('img', { name: /Wrapped PNG preview/ })).toBeVisible();
  const lightAudit = await new AxeBuilder({ page: dashboard }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(lightAudit.violations.map(({ id }) => id)).toEqual([]);
  await dialog.screenshot({ path: testInfo.outputPath('wrapped-preview-light.png') });
  await dashboard.setViewportSize({ width: 390, height: 700 });
  expect(await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dashboard.screenshot({ path: testInfo.outputPath('wrapped-preview-narrow.png') });
});

test('deleting history in another tab invalidates the displayed card instead of leaving old data exportable', async ({ beta }) => {
  await beta.enable();
  const website = await beta.open();
  await scrollTo(website, 900);
  await expect.poll(beta.distance).toBe(900);
  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html`);
  await dashboard.getByRole('button', { name: 'Preview my Wrapped' }).click();
  await expect(dashboard.getByRole('dialog').getByRole('img', { name: /Wrapped PNG preview/ })).toBeVisible();
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Delete history', exact: true }).click();
  await beta.options.getByRole('button', { name: 'Delete & pause' }).click();
  await expect(beta.options.getByRole('status')).toContainText('All history deleted');
  await dashboard.bringToFront();
  await expect(dashboard.getByRole('dialog')).toHaveCount(0);
  await expect(dashboard.locator('.overview-metrics .metric-card').filter({ hasText: 'The raw distance' }).locator('strong')).toHaveText('0px');
  await dashboard.getByRole('button', { name: 'Preview my Wrapped' }).click();
  await expect(dashboard.getByRole('dialog').getByText(/No scrolling recorded for this period/)).toBeVisible();
  await expect(dashboard.getByRole('dialog').getByRole('img', { name: /Wrapped PNG preview/ })).toBeVisible();
});