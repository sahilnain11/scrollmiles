import AxeBuilder from '@axe-core/playwright';
import { test, expect, scrollTo } from './beta-fixture';
import type { Page } from '@playwright/test';

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
}

test('popup first use is honest, keyboard-accessible, and never enables optional tracking by itself', async ({ beta }, testInfo) => {
  const popup = await beta.context.newPage();
  await popup.setViewportSize({ width: 390, height: 600 });
  await popup.goto(`chrome-extension://${beta.extensionId}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'Choose a website to begin' })).toBeVisible();
  await expect(popup.getByRole('textbox', { name: 'Website to enable' })).toBeVisible();
  await expect(popup.getByRole('link', { name: 'Your full story' })).toBeVisible();
  expect(await popup.locator('.app.popup').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(600);
  expect((await beta.options.evaluate(() => chrome.permissions.getAll())).origins ?? []).toEqual([]);
  expect((await beta.snapshot()).settings.allSitesEnabled).toBe(false);
  expect((await beta.snapshot()).settings.siteInsightsEnabled).toBe(false);
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await popup.keyboard.press('Enter');
  await expect(popup.locator('main')).toBeFocused();
  await audit(popup);
  await popup.screenshot({ path: testInfo.outputPath('popup-first-use.png'), fullPage: true });
  await popup.getByRole('textbox', { name: 'Website to enable' }).fill('chrome://settings');
  await popup.getByRole('textbox', { name: 'Website to enable' }).press('Enter');
  await expect(popup.getByRole('alert')).toContainText('http or https');
  expect((await beta.options.evaluate(() => chrome.permissions.getAll())).origins ?? []).toEqual([]);
  expect(await popup.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('popup fits its quick-glance height with real data and controls global pause without losing history', async ({ beta }, testInfo) => {
  await beta.enable();
  const website = await beta.open();
  await scrollTo(website, 2000);
  await expect.poll(beta.distance).toBe(2000);
  const popup = await beta.context.newPage();
  await popup.setViewportSize({ width: 390, height: 600 });
  await popup.goto(`chrome-extension://${beta.extensionId}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'Tracking enabled', exact: true })).toBeVisible();
  await expect(popup.getByText('No timed interval yet', { exact: true })).toBeVisible();
  await expect(popup.getByRole('link', { name: 'Your full story' })).toBeVisible();
  expect(await popup.locator('.app.popup').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(600);
  expect(await popup.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await audit(popup);
  await popup.screenshot({ path: testInfo.outputPath('popup-dark.png'), fullPage: true });

  await popup.getByRole('button', { name: 'Tracking enabled. Pause tracking' }).click();
  await expect(popup.getByRole('button', { name: 'Tracking paused. Resume tracking' })).toBeVisible();
  await expect.poll(async () => (await beta.snapshot()).settings.trackingEnabled).toBe(false);
  await website.bringToFront();
  await scrollTo(website, 3000);
  await popup.bringToFront();
  expect(await beta.distance()).toBe(2000);
  await popup.screenshot({ path: testInfo.outputPath('popup-paused.png'), fullPage: true });
  await popup.getByRole('button', { name: 'Tracking paused. Resume tracking' }).click();
  await expect(popup.getByRole('heading', { name: 'Tracking enabled', exact: true })).toBeVisible();
  await website.bringToFront();
  await scrollTo(website, 3500);
  await expect.poll(beta.distance).toBe(2500);
  await popup.bringToFront();
  await popup.getByRole('button', { name: 'Last 7 days', exact: true }).click();
  await expect(popup.getByRole('heading', { name: 'Your week, in scrolling.' })).toBeVisible();
  const downloaded = popup.waitForEvent('download');
  await popup.getByRole('button', { name: 'Download Wrapped card for the last 7 days' }).click();
  expect((await downloaded).suggestedFilename()).toBe('scrollmiles-week.png');
  await expect(popup.getByRole('status')).toContainText('downloaded');
  await popup.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(popup.locator('html')).toHaveAttribute('data-theme', 'light');
  await audit(popup);
  await popup.screenshot({ path: testInfo.outputPath('popup-light.png'), fullPage: true });
  await popup.setViewportSize({ width: 320, height: 600 });
  expect(await popup.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await audit(popup);
  await popup.screenshot({ path: testInfo.outputPath('popup-320.png'), fullPage: true });
});

test('popup insights/settings links open real extension documents and never change insights consent', async ({ beta }) => {
  await beta.enableAll();
  await beta.options.getByRole('button', { name: 'Set up website insights' }).click();
  await beta.options.getByRole('button', { name: 'Enable website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Turn off & delete website insights' })).toBeVisible();
  const website = await beta.open();
  await scrollTo(website, 600);
  await expect.poll(beta.distance).toBe(600);
  const popup = await beta.context.newPage();
  await popup.setViewportSize({ width: 390, height: 600 });
  await popup.goto(`chrome-extension://${beta.extensionId}/popup.html`);
  await expect(popup.getByText('All supported sites · 0 exact-host exclusions')).toBeVisible();
  await expect(popup.getByRole('textbox', { name: 'Website to exclude' })).toHaveCount(0);
  const insightsPromise = beta.context.waitForEvent('page');
  await popup.getByRole('link', { name: /Website insights/ }).click();
  const insights = await insightsPromise;
  await expect(insights).toHaveURL(`chrome-extension://${beta.extensionId}/dashboard.html#website-insights`);
  await expect(insights.getByRole('searchbox', { name: 'Find a recorded website' })).toBeVisible();
  await expect(insights.getByRole('alert')).toHaveCount(0);
  await popup.bringToFront();
  const settingsPromise = beta.context.waitForEvent('page');
  await popup.getByRole('link', { name: 'Privacy and settings' }).click();
  const settings = await settingsPromise;
  await expect(settings).toHaveURL(`chrome-extension://${beta.extensionId}/options.html`);
  await expect(settings.getByRole('button', { name: 'Turn off & delete website insights' })).toBeVisible();
  expect((await beta.snapshot()).settings.siteInsightsEnabled).toBe(true);
});