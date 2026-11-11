import AxeBuilder from '@axe-core/playwright';
import { test, expect, scrollTo } from './beta-fixture';

test('website insights require consent, keep anonymous history separate, and erase detail without changing totals', async ({ beta }, testInfo) => {
  expect((await beta.snapshot()).settings.siteInsightsEnabled).toBe(false);
  await beta.enableAll();
  const first = await beta.open();
  await scrollTo(first, 400);
  await expect.poll(beta.distance).toBe(400);
  expect((await beta.snapshot()).siteHours).toEqual([]);

  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Set up website insights' }).click();
  await expect(beta.options.getByRole('group', { name: 'Confirm website insights' })).toContainText('exact scheme/hostnames');
  await beta.options.getByRole('button', { name: 'Keep anonymous totals only' }).click();
  expect((await beta.snapshot()).settings.siteInsightsEnabled).toBe(false);
  await beta.options.getByRole('button', { name: 'Set up website insights' }).click();
  await beta.options.getByRole('button', { name: 'Enable website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Turn off & delete website insights' })).toBeVisible();
  expect((await beta.snapshot()).siteHours).toEqual([]);

  await first.bringToFront();
  await scrollTo(first, 1000);
  await expect.poll(beta.distance).toBe(1000);
  const second = await beta.open(beta.site.replace('scrollmiles.test', 'www.scrollmiles.test'));
  await scrollTo(second, 300);
  await expect.poll(beta.distance).toBe(1300);
  const snapshot = await beta.snapshot();
  expect(snapshot.siteHours?.reduce((total, row) => total + row.distancePx, 0)).toBe(900);
  expect(snapshot.siteHours?.map(({ site }) => site).sort()).toEqual(['http://scrollmiles.test', 'http://www.scrollmiles.test']);
  for (const row of snapshot.siteHours ?? []) expect(row.hour).toBeGreaterThanOrEqual(0);

  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html`);
  await expect(dashboard.getByRole('navigation', { name: 'Choose a website to analyze' })).toBeVisible();
  await expect(dashboard.getByRole('button', { name: /http:\/\/scrollmiles.test/ })).toHaveAttribute('aria-pressed', 'true');
  await dashboard.getByText('View hourly rhythm values', { exact: true }).click();
  await expect(dashboard.getByRole('table', { name: 'Hourly rhythm — exact scrolling totals' })).toBeVisible();
  await dashboard.getByRole('button', { name: /http:\/\/www.scrollmiles.test/ }).click();
  await expect(dashboard.locator('.insight-host')).toHaveText('http://www.scrollmiles.test');
  await dashboard.getByRole('button', { name: 'Last 7 days', exact: true }).click();
  const darkAudit = await new AxeBuilder({ page: dashboard }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(darkAudit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  await dashboard.screenshot({ path: testInfo.outputPath('site-insights-dark.png'), fullPage: true });
  await dashboard.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(dashboard.locator('html')).toHaveAttribute('data-theme', 'light');
  const lightAudit = await new AxeBuilder({ page: dashboard }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(lightAudit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
  await dashboard.screenshot({ path: testInfo.outputPath('site-insights-light.png'), fullPage: true });
  await dashboard.setViewportSize({ width: 390, height: 900 });
  expect(await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dashboard.locator('#website-insights').scrollIntoViewIfNeeded();
  await dashboard.screenshot({ path: testInfo.outputPath('site-insights-narrow.png') });

  await dashboard.getByRole('button', { name: 'Delete website history', exact: true }).click();
  await dashboard.getByRole('button', { name: 'Cancel website deletion' }).click();
  expect((await beta.snapshot()).siteHours).toHaveLength(2);
  await dashboard.getByRole('button', { name: 'Delete website history', exact: true }).click();
  await dashboard.getByRole('button', { name: 'Delete this website’s history' }).click();
  await expect.poll(async () => (await beta.snapshot()).siteHours?.map(({ site }) => site)).toEqual(['http://scrollmiles.test']);
  expect(await beta.distance()).toBe(1300);

  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Turn off & delete website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Set up website insights' })).toBeVisible();
  expect((await beta.snapshot()).siteHours).toEqual([]);
  expect(await beta.distance()).toBe(1300);
  await first.bringToFront();
  await scrollTo(first, 1200);
  await expect.poll(beta.distance).toBe(1500);
  expect((await beta.snapshot()).siteHours).toEqual([]);
});

test('site exclusions and worker restart preserve the detailed opt-in boundary', async ({ beta }) => {
  await beta.enableAll();
  await beta.options.getByRole('button', { name: 'Set up website insights' }).click();
  await beta.options.getByRole('button', { name: 'Enable website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Turn off & delete website insights' })).toBeVisible();
  const page = await beta.open();
  await scrollTo(page, 500);
  await expect.poll(beta.distance).toBe(500);
  await beta.options.bringToFront();
  await beta.options.getByRole('textbox', { name: 'Website to exclude' }).fill('http://scrollmiles.test');
  await beta.options.getByRole('button', { name: 'Exclude website' }).click();
  await expect(beta.options.getByRole('button', { name: 'Stop excluding http://scrollmiles.test' })).toBeVisible();
  await page.bringToFront();
  await scrollTo(page, 1200);
  await beta.options.goto(`chrome-extension://${beta.extensionId}/privacy.html`);
  await beta.stopWorker();
  await beta.options.goto(`chrome-extension://${beta.extensionId}/options.html`);
  await expect(beta.options.getByRole('button', { name: 'Turn off & delete website insights' })).toBeVisible();
  expect(await beta.distance()).toBe(500);
  expect((await beta.snapshot()).siteHours?.reduce((sum, row) => sum + row.distancePx, 0)).toBe(500);
  await beta.options.getByRole('button', { name: 'Delete history', exact: true }).click();
  await beta.options.getByRole('button', { name: 'Delete & pause' }).click();
  await expect(beta.options.getByRole('status')).toContainText('All history deleted');
  expect((await beta.snapshot()).siteHours).toEqual([]);
  expect(await beta.distance()).toBe(0);
});