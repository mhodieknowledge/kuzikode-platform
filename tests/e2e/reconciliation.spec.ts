/**
 * P6.4: finance sees an invoice's online payment attempts and presses "Check now" (docs/06 §3). The seeded attempt
 * (global-setup: inv_e2e_recon / pat_e2e_recon) is still waiting at the mock gateway, so the check reports no change.
 * The paths that change something (missed callback applied, expiry, reversal) are covered in
 * tests/integration/reconciliation.test.ts.
 */
import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('reconciliation'));

test('admin invoice: online payment attempts with "Check now"', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/login');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(E2E_USERS.reconAdmin.email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/invoices/inv_e2e_recon');
  const panel = page.getByRole('region', { name: 'Online payment attempts' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('astro-island')).not.toHaveAttribute('ssr');
  await expect(panel.getByText('EcoCash')).toBeVisible();
  await expect(panel.getByText('Waiting', { exact: true })).toBeVisible();
  await expect(panel.getByText('Not checked with the gateway yet')).toBeVisible();
  await expectAccessible(page);

  const button = panel.getByRole('button', { name: /^Check now with the gateway: EcoCash \$40\.00/ });
  await button.click();
  await expect(panel.getByText('Checked with the gateway: no change (Waiting).')).toBeVisible();
  await expect(panel.getByText(/^Checked 1 time, last /)).toBeVisible();
  await expect(button).toBeEnabled();
  await screenshots(page, 'admin-invoice-attempts');
});
