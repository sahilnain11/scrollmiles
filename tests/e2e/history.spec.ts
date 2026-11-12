import AxeBuilder from '@axe-core/playwright';
import { daysAgo, localDate } from '../../src/analytics/metrics';
import type { DayStats, RetainedHistory, Response } from '../../src/types';
import { test, expect, scrollTo } from './beta-fixture';

test('monthly history uses actual anonymous scrolling without enabling detail and clears after history deletion', async ({ beta }) => {
  await beta.enable();
  const website = await beta.open();
  await scrollTo(website, 600);
  await expect.poll(beta.distance).toBe(600);
  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html#history`);
  const history = dashboard.getByRole('region', { name: 'Your recent history', exact: true });
  await expect(history).toBeVisible();
  await expect(history.getByText('600 CSS px · estimated screen equivalent')).toBeVisible();
  await expect(history.getByText('No positive record yet')).toHaveCount(3);
  await expect(history.getByRole('button', { name: /today still in progress/ })).toHaveCount(1);
  const settings = (await beta.snapshot()).settings;
  expect(settings.siteInsightsEnabled).toBe(false);
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Set up website insights' }).click();
  await beta.options.getByRole('button', { name: 'Enable website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Turn off & delete website insights' })).toBeVisible();
  await website.bringToFront();
  await scrollTo(website, 900);
  await expect.poll(beta.distance).toBe(900);
  await dashboard.bringToFront();
  await expect(history.getByText('900 CSS px · estimated screen equivalent')).toBeVisible();
  await dashboard.getByRole('button', { name: 'Delete website history', exact: true }).click();
  await dashboard.getByRole('button', { name: 'Delete this website’s history' }).click();
  await expect(history.getByText('900 CSS px · estimated screen equivalent')).toBeVisible();
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Turn off & delete website insights' }).click();
  await expect(beta.options.getByRole('button', { name: 'Set up website insights' })).toBeVisible();
  await dashboard.bringToFront();
  await expect(history.getByText('900 CSS px · estimated screen equivalent')).toBeVisible();
  await beta.options.bringToFront();
  await beta.options.getByRole('button', { name: 'Delete history', exact: true }).click();
  await beta.options.getByRole('button', { name: 'Delete & pause' }).click();
  await dashboard.bringToFront();
  await expect(history.getByText('0 CSS px · estimated screen equivalent')).toBeVisible();
  await expect(history.getByText(/No saved totals for this month/)).toBeVisible();
  await expect(history.getByRole('button', { name: /Saved aggregate,/ })).toHaveCount(0);
  expect(await beta.distance()).toBe(0);
});

test('retained records and monthly calendars respect date bounds, ties, exact values, keyboard and themes', async ({ beta }, testInfo) => {
  const anchor = await beta.options.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SNAPSHOT', includeHistory: true }) as Response<{ history: RetainedHistory }>;
    if (!response.ok) throw new Error(response.error);
    return response.data.history;
  });
  const now = new Date(`${anchor.endDate}T12:00:00`);
  const previousMonth = localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1, 12)).slice(0, 7);
  const rows: DayStats[] = [
    { date: `${previousMonth}-01`, distancePx: 900, actions: 2, activeMs: 200 },
    { date: `${previousMonth}-02`, distancePx: 900, actions: 3, activeMs: 500 },
    { date: `${previousMonth}-03`, distancePx: 0, actions: 0, activeMs: 0 },
    { date: anchor.startDate, distancePx: 250, actions: 1, activeMs: 0 },
    { date: anchor.endDate, distancePx: 5000, actions: 99, activeMs: 9999 },
    { date: daysAgo(90, now), distancePx: 1e6, actions: 999, activeMs: 99999 },
    { date: daysAgo(-1, now), distancePx: 1e6, actions: 999, activeMs: 99999 },
  ];
  // Synthetic past-history fixture in a disposable profile only: verifies
  // real DB/worker/UI reads, not 90 days of measured collector activity.
  await beta.options.evaluate(async (rows) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('scrollmiles');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('days', 'readwrite');
        rows.forEach((row) => tx.objectStore('days').put(row));
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, rows);
  const dashboard = await beta.context.newPage();
  await dashboard.goto(`chrome-extension://${beta.extensionId}/dashboard.html#history`);
  const history = dashboard.getByRole('region', { name: 'Your recent history', exact: true });
  const records = history.getByRole('region', { name: 'Personal records within retained history' });
  await expect(records.getByText('2 dates tied')).toBeVisible();
  await expect(records.getByText('900 CSS px')).toBeVisible();
  await expect(records).not.toContainText('5,000');
  await expect(history).not.toContainText('1,000,000');
  await records.getByText('View tied dates for distance').click();
  await expect(records.getByRole('listitem')).toHaveText([`${previousMonth}-01`, `${previousMonth}-02`]);
  await history.getByRole('combobox', { name: 'Month', exact: true }).selectOption(previousMonth);
  await expect(history.getByText('1,800 CSS px · estimated screen equivalent')).toBeVisible();
  const calendar = history.getByRole('table', { name: /Monthly recorded distance calendar/ });
  const days = calendar.getByRole('button');
  await calendar.getByRole('button', { name: `2, ${previousMonth}-02: Saved aggregate, 900 CSS px` }).focus();
  await dashboard.keyboard.press('ArrowLeft');
  await expect(days.first()).toBeFocused();
  await dashboard.keyboard.press('Control+End');
  await expect(days.last()).toBeFocused();
  await calendar.getByRole('button', { name: `3, ${previousMonth}-03: Saved aggregate, 0 CSS px` }).click();
  await expect(history.locator('.history-day-readout')).toContainText('Saved aggregate');
  await calendar.getByRole('button', { name: `4, ${previousMonth}-04: No saved record; coverage unknown` }).click();
  await expect(history.locator('.history-day-readout')).toContainText('does not prove zero activity');
  await history.getByText('View exact monthly totals', { exact: true }).click();
  const exact = history.getByRole('table', { name: /Monthly anonymous daily totals/ });
  const missing = exact.getByRole('row', { name: new RegExp(`${previousMonth}-04`) });
  await expect(missing.getByRole('cell').nth(1)).toHaveText('—');
  await history.getByText('View exact monthly totals', { exact: true }).click();
  for (const theme of ['dark', 'light'] as const) {
    if (theme === 'light') {
      await dashboard.getByRole('button', { name: 'Switch to light theme' }).click();
      await expect(dashboard.locator('html')).toHaveAttribute('data-theme', 'light');
    }
    const audit = await new AxeBuilder({ page: dashboard }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    await history.screenshot({ path: testInfo.outputPath(`history-${theme}.png`) });
  }
  const oldest = (await history.getByRole('combobox', { name: 'Month', exact: true }).locator('option').last().getAttribute('value'))!;
  await history.getByRole('combobox', { name: 'Month', exact: true }).selectOption(oldest);
  await expect(history.getByRole('button', { name: new RegExp(`${oldest}-01: Outside the retained window`) })).toBeVisible();
  await dashboard.setViewportSize({ width: 390, height: 900 });
  expect(await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await history.scrollIntoViewIfNeeded();
  await dashboard.screenshot({ path: testInfo.outputPath('history-narrow.png') });
  await history.getByRole('table', { name: /Monthly recorded distance calendar/ }).screenshot({ path: testInfo.outputPath('history-calendar-narrow.png') });
});