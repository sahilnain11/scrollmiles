import AxeBuilder from '@axe-core/playwright';
import { daysAgo } from '../../src/analytics/metrics';
import { test, expect, scrollTo } from './beta-fixture';

test('Smart Insights uses real scrolls and opt-in hours, stays keyboard accessible, and forgets deleted detail', async ({ beta }, testInfo) => {
  await beta.enable();
  const website = await beta.open();
  await scrollTo(website, 500);
  await expect.poll(beta.distance).toBe(500);
  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html#smart-insights`);
  const insights = dashboard.getByRole('region', { name: 'Smart insights', exact: true });
  await expect(insights).toBeVisible();
  await expect(insights.getByText('Hourly detail unavailable')).toBeVisible();
  await expect(insights.getByRole('grid')).toHaveCount(0);
  await expect(insights.getByText(/Not enough comparable history yet/)).toBeVisible();
  await expect(insights.getByText(/No percentage is inferred/)).toBeVisible();
  expect((await beta.snapshot()).settings.siteInsightsEnabled).toBe(false);

  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Set up website insights' }).click();
  await beta.options.getByRole('button', { name: 'Enable website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Turn off & delete website insights' })).toBeVisible();
  await website.bringToFront();
  await scrollTo(website, 800);
  await expect.poll(beta.distance).toBe(800);
  await dashboard.bringToFront();
  const grid = insights.getByRole('grid', { name: /Seven-day recorded-site heatmap/ });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole('gridcell')).toHaveCount(168);
  const recorded = grid.getByRole('gridcell', { name: /: 300 CSS px$/ });
  await expect(recorded).toHaveCount(1);
  await recorded.focus();
  await dashboard.keyboard.press('Home');
  const allCells = grid.getByRole('gridcell');
  await expect(allCells.nth(144)).toBeFocused();
  await dashboard.keyboard.press('ArrowUp');
  await expect(allCells.nth(120)).toBeFocused();
  await dashboard.keyboard.press('Control+End');
  await expect(allCells.nth(167)).toBeFocused();
  await expect(insights).not.toContainText('http://scrollmiles.test');
  await insights.getByRole('combobox', { name: 'Heatmap metric' }).selectOption('activeMs');
  await expect(insights.getByText('No activity for this metric')).toBeVisible();
  await insights.getByRole('combobox', { name: 'Heatmap metric' }).selectOption('distancePx');
  await insights.getByText('View exact heatmap values', { exact: true }).click();
  await expect(insights.getByRole('table', { name: 'Seven-day recorded-site hourly totals' }).getByRole('row')).toHaveCount(169);
  await insights.getByText('View exact heatmap values', { exact: true }).click();
  for (const theme of ['dark', 'light'] as const) {
    if (theme === 'light') {
      await dashboard.getByRole('button', { name: 'Switch to light theme' }).click();
      await expect(dashboard.locator('html')).toHaveAttribute('data-theme', 'light');
    }
    const audit = await new AxeBuilder({ page: dashboard }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    await insights.screenshot({ path: testInfo.outputPath(`smart-insights-${theme}.png`) });
  }
  await dashboard.setViewportSize({ width: 390, height: 900 });
  expect(await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await grid.evaluate((element) => element.scrollWidth > element.parentElement!.clientWidth)).toBe(true);
  await allCells.nth(167).focus();
  await expect(allCells.nth(167)).toBeFocused();
  await insights.scrollIntoViewIfNeeded();
  await dashboard.screenshot({ path: testInfo.outputPath('smart-insights-narrow.png') });

  await dashboard.getByRole('button', { name: 'Delete website history', exact: true }).click();
  await dashboard.getByRole('button', { name: 'Delete this website’s history' }).click();
  await expect(grid.getByRole('gridcell', { name: /300 CSS px/ })).toHaveCount(0);
  await expect(insights.getByText('No recorded peak yet')).toBeVisible();
  expect(await beta.distance()).toBe(800);
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Turn off & delete website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Set up website insights' })).toBeVisible();
  await dashboard.bringToFront();
  await expect(grid).toHaveCount(0);
  expect(await beta.distance()).toBe(800);
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Delete history', exact: true }).click();
  await beta.options.getByRole('button', { name: 'Delete & pause' }).click();
  await dashboard.bringToFront();
  await expect(insights.getByText('No recorded day yet')).toBeVisible();
  expect((await beta.snapshot()).comparisonDays).toEqual([]);
});

test('complete-period comparison reads existing anonymous history and suppresses a missing baseline date', async ({ beta }) => {
  // Explicit synthetic HISTORY fixture in a disposable profile only. This
  // exercises the real DB/worker/UI contract, not collector measurement.
  // Current-day real scroll tests above remain separate and unseeded.
  const dates = Array.from({ length: 14 }, (_, index) => daysAgo(index + 1));
  await beta.options.evaluate(async (dates) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('scrollmiles');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('days', 'readwrite');
        dates.forEach((date, index) => tx.objectStore('days').put({ date, distancePx: index < 7 ? 200 : 100, actions: 1, activeMs: 0 }));
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, dates);
  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html#smart-insights`);
  const insights = dashboard.getByRole('region', { name: 'Smart insights', exact: true });
  await expect(insights.getByText('700 CSS px more')).toBeVisible();
  await expect(insights.getByText('100% more recorded')).toBeVisible();
  await expect(insights.getByText('No percentage: previous total is zero')).toBeVisible();
  expect((await beta.snapshot()).days).toHaveLength(6); // today remains genuinely empty
  expect((await beta.snapshot()).comparisonDays).toHaveLength(14);
  await beta.options.evaluate(async (date) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('scrollmiles');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('days', 'readwrite'); tx.objectStore('days').delete(date);
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, dates[13]!);
  await dashboard.bringToFront();
  await expect(insights.getByText(/Not enough comparable history yet/)).toBeVisible();
  await expect(insights.getByText('100% more recorded')).toHaveCount(0);
});