/** P6.3c: the Super Administrator manages gateway accounts and routes (2FA sign-in with the e2e TOTP secret). */
import { expect, test } from '@playwright/test';
import { totp } from '../../src/server/lib/totp';
import { expectAccessible, screenshots } from './helpers';
import { E2E_PASSWORD, E2E_SUPER_TOTP_SECRET, E2E_USERS } from './users';

test('Super Admin: gateway accounts with secret status, add and remove a route', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login?next=%2Fadmin%2Fpayments%2Fgateways');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(E2E_USERS.superAdmin.email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Authentication code').fill(await totp(E2E_SUPER_TOTP_SECRET, Date.now()));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/admin\/payments\/gateways$/);

  await expect(page.getByRole('heading', { name: 'Paynow USD' })).toBeVisible();
  await expect(page.getByText('PAYNOW_USD_INTEGRATION_KEY ✗ missing')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mock gateway (test only)' })).toBeVisible();
  await expect(page.locator('astro-island').filter({ hasText: 'Add route' })).not.toHaveAttribute('ssr');
  await expectAccessible(page);
  await screenshots(page, 'admin-payment-gateways');
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add a ZWG route to the mock account, then remove it again.
  await page.getByRole('button', { name: 'Add route' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Account').selectOption('ppa_mock');
  await dialog.getByLabel('Currency').selectOption('USD');
  await dialog.getByLabel('Method').selectOption('innbucks');
  await dialog.getByLabel('Priority').fill('42');
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Add route' }).click();
  const row = page.getByRole('row').filter({ hasText: 'InnBucks' }).filter({ hasText: '42' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /^Remove/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove route' }).click();
  await expect(row).toHaveCount(0);
});
