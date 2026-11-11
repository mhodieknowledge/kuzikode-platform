import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('reports'));

async function signIn(page: Page, email: string) {
  await page.goto('/admin/login');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('reports with date range and CSV export; audit log filters and export (P4.18)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.reportsAdmin.email);
  const nav = page.getByRole('complementary', { name: 'Admin' });

  await nav.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
  for (const h of [
    'Revenue received by month',
    'Indicative profit',
    'Outstanding and ageing',
    'Quotation conversion',
    'Expenses by category',
  ])
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await page.getByLabel('From').fill('2026-01-01');
  await page.getByLabel('To').fill('2026-12-31');
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(page).toHaveURL(/from=2026-01-01&to=2026-12-31/);
  const href = await page
    .locator('section', { hasText: 'Indicative profit' })
    .getByRole('link', { name: 'Export CSV' })
    .getAttribute('href');
  const csv = await page.request.get(href!);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('Period 2026-01-01 to 2026-12-31');
  await expectAccessible(page);
  await screenshots(page, 'admin-reports');

  await nav.getByRole('link', { name: 'Audit log', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
  // The CSV export just made is itself in the log.
  await page.getByLabel('Action').fill('report.exported');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByRole('cell', { name: 'report.exported' }).first()).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-audit');
  const audit = await page.request.get('/api/v1/admin/audit/export.csv?action=report.exported');
  expect(audit.status()).toBe(200);
  expect((await audit.text()).split('\r\n')[0]).toContain('Time (UTC),Actor');
  // Data export is Super Admin only.
  expect((await page.request.get('/admin/settings/data-export')).status()).toBe(403);
});
