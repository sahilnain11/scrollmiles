// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryOverview } from '../src/components/HistoryOverview';
import type { RetainedHistory } from '../src/types';

afterEach(cleanup);
const data = (): RetainedHistory => ({ startDate: '2026-08-15', endDate: '2026-11-12', days: [
  { date: '2026-10-31', distancePx: 500, actions: 2, activeMs: 200 },
  { date: '2026-11-11', distancePx: 500, actions: 3, activeMs: 500 },
  { date: '2026-11-12', distancePx: 9999, actions: 99, activeMs: 9999 },
  { date: '2026-11-01', distancePx: 0, actions: 0, activeMs: 0 },
] });

describe('retained history UI', () => {
  it('shows retained daily records with explicit ties and partial-today exclusion', async () => {
    render(<HistoryOverview history={data()} stale={false} />);
    const records = screen.getByRole('region', { name: 'Personal records within retained history' });
    expect(within(records).getByText('2 dates tied')).toBeTruthy();
    expect(within(records).queryByText('9,999 CSS px')).toBeNull();
    expect(within(records).getByText(/Today is excluded/)).toBeTruthy();
    expect(within(records).getByText(/daily total, not a single burst/)).toBeTruthy();
    await userEvent.setup().click(within(records).getByText('View tied dates for distance'));
    expect(within(records).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['2026-10-31', '2026-11-11']);
  });
  it('keeps today visible as partial, and distinguishes missing, zero, future and expired dates', async () => {
    render(<HistoryOverview history={data()} stale={false} />);
    const user = userEvent.setup();
    const calendar = screen.getByRole('table', { name: 'Monthly recorded distance calendar — November 2026' });
    expect(within(calendar).getByRole('button', { name: /2026-11-12/ }).getAttribute('aria-current')).toBe('date');
    await user.click(within(calendar).getByRole('button', { name: /2026-11-02/ }));
    expect(screen.getByText('No saved record; coverage unknown', { selector: 'p' })).toBeTruthy();
    await user.click(within(calendar).getByRole('button', { name: /2026-11-01/ }));
    expect(screen.getByText('Saved aggregate', { selector: 'p' })).toBeTruthy();
    await user.click(within(calendar).getByRole('button', { name: /2026-11-13/ }));
    expect(screen.getByText('Future date; not measured', { selector: 'p' })).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-08');
    expect(screen.getByText(/Earlier dates are outside retention/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /2026-08-01/ }));
    expect(screen.getByText('Outside the retained window', { selector: 'p' })).toBeTruthy();
  });
  it('provides one tabbable calendar date, arrow/Home/End navigation and exact missing-data values', async () => {
    render(<HistoryOverview history={data()} stale={false} />);
    const calendar = screen.getByRole('table', { name: /Monthly recorded distance calendar/ });
    const buttons = within(calendar).getAllByRole('button');
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    const user = userEvent.setup();
    await user.click(buttons[11]!);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(buttons[10]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(buttons[3]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(buttons[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(buttons[6]);
    await user.keyboard('{Control>}{End}{/Control}');
    expect(document.activeElement).toBe(buttons[29]);
    await user.click(screen.getByText('View exact monthly totals'));
    const table = screen.getByRole('table', { name: 'Monthly anonymous daily totals — November 2026' });
    expect(within(table).getAllByRole('row')).toHaveLength(31);
    const missing = within(table).getByRole('row', { name: /2026-11-02/ });
    expect(missing.textContent).toContain('coverage unknown');
    expect(within(missing).getAllByRole('cell').slice(1).map((cell) => cell.textContent)).toEqual(['—', '—', '—']);
  });
  it('keeps month selection through live refresh and removes observations on deletion or stale reads', async () => {
    const initial = data();
    const view = render(<HistoryOverview history={initial} stale={false} />);
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-10');
    view.rerender(<HistoryOverview history={{ ...initial, days: [] }} stale={false} />);
    expect((screen.getByRole('combobox', { name: 'Month' }) as HTMLSelectElement).value).toBe('2026-10');
    expect(screen.getAllByText('No positive record yet')).toHaveLength(3);
    expect(screen.getByText(/No saved totals for this month/)).toBeTruthy();
    view.rerender(<HistoryOverview history={initial} stale />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Most distance in a day')).toBeNull();
    expect(screen.getByText(/History observations are unavailable/)).toBeTruthy();
  });
  it('shows reload guidance for an older worker instead of a zero-filled month', () => {
    render(<HistoryOverview history={undefined} stale={false} />);
    expect(screen.getByText(/Retained history is unavailable from this worker/)).toBeTruthy();
    expect(screen.queryByText('Saved distance')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});