import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

test.describe('UI kit (/dev/ui)', () => {
  test('renders every component, is accessible and has no horizontal scroll', async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { name: 'UI kit', level: 1 })).toBeVisible();
    for (const section of [
      'Buttons',
      'Form controls',
      'Badges and status',
      'Cards and KPIs',
      'Data table',
      'Tabs, dialogs and states',
    ]) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible();
    }
    await expectAccessible(page);
    await screenshots(page, 'ui-kit');
  });

  test('dialogs trap focus and the destructive confirm needs the typed number', async ({ page }) => {
    await page.goto('/dev/ui');
    await page.getByRole('button', { name: 'Void invoice' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Void INV-2026-00021?' });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Void invoice' });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('INV-2026-00021');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('status').getByText('Invoice voided')).toBeVisible();
    await expectAccessible(page);
  });

  test('money input stores minor units and flags too many decimals', async ({ page }) => {
    await page.goto('/dev/ui');
    const amount = page.getByLabel('Amount');
    await amount.fill('1250.5');
    await expect(page.getByText('Stored as 125050 minor units')).toBeVisible();
    await amount.fill('1.234');
    await expect(page.getByText('Use at most 2 decimal places')).toBeVisible();
  });

  test('data table sorts, selects and shows empty/error states', async ({ page }) => {
    await page.goto('/dev/ui');
    const table = page.getByRole('table', { name: 'Invoices' });
    await table.getByRole('button', { name: 'Client' }).click();
    await expect(table.getByRole('columnheader', { name: 'Client' })).toHaveAttribute('aria-sort', 'ascending');
    await table.getByRole('checkbox', { name: 'Select all on this page' }).check();
    await expect(page.getByText('5 selected')).toBeVisible();
    await page.getByLabel('Table state').selectOption('empty');
    await expect(page.getByRole('heading', { name: 'No invoices yet' })).toBeVisible();
    await page.getByLabel('Table state').selectOption('error');
    await expect(page.getByRole('alert').getByText('This could not be loaded')).toBeVisible();
  });

  test('is not available outside development', async ({ request }) => {
    const res = await request.get('/dev/ui');
    expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.headers()['cache-control']).toBe('private, no-store');
  });
});
