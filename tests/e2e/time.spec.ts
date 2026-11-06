import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

async function signIn(page: Page, email: string) {
  await page.goto('/admin/login');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
const hydrated = (page: Page, text: string) =>
  expect(page.locator('astro-island').filter({ hasText: text }).first()).not.toHaveAttribute('ssr', {
    timeout: 10_000,
  });

test('time: timer, manual entry, weekly timesheet, bill unbilled time to a draft invoice (P4.23)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.timeAdmin.email);
  const n = Date.now() % 100000;
  const timed = `Catalogue import ${n}`;
  const call = `Supplier call ${n}`;
  await page.getByRole('complementary', { name: 'Admin' }).getByRole('link', { name: 'Time', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Time' })).toBeVisible();

  // Timer
  await hydrated(page, 'Start timer');
  await page.getByLabel('Project').first().selectOption({ label: 'PRJ-E2E-TIME · Parts catalogue' });
  await page.getByLabel('What are you working on?').fill(timed);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByText(/Timer running/)).toBeVisible();
  await hydrated(page, 'Stop and save');
  await page.getByRole('button', { name: 'Stop and save' }).click();
  await expect(page.getByRole('cell', { name: timed, exact: true })).toBeVisible();

  // Manual entry
  await hydrated(page, 'Log time');
  await page.getByRole('button', { name: 'Log time' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project').selectOption({ label: 'PRJ-E2E-TIME · Parts catalogue' });
  await dialog.getByLabel('Hours').fill('1');
  await dialog.getByLabel('Minutes').fill('30');
  await dialog.getByLabel('Description').fill(call);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: call, exact: true })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-time');

  // Timesheet
  await page.getByRole('link', { name: 'Timesheet' }).click();
  await expect(page.getByRole('rowheader', { name: 'PRJ-E2E-TIME · Parts catalogue' })).toBeVisible();
  await expectAccessible(page);

  // Bill
  await page.getByRole('link', { name: 'Unbilled time' }).click();
  await page.locator('li', { hasText: 'PRJ-E2E-TIME' }).getByRole('link', { name: 'Review and bill' }).click();
  await hydrated(page, 'Create draft invoice');
  await expect(page.getByRole('cell', { name: call, exact: true })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-time-bill');
  await page.getByRole('button', { name: 'Create draft invoice' }).click();
  await expect(page).toHaveURL(/\/admin\/invoices\/inv_/);
  await expect(
    page.getByRole('cell', {
      name: `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Harare' }).format(new Date())} · Tino Time · ${call}`,
    }),
  ).toBeVisible();

  // Billed time shows on the project's Time tab and no longer appears as unbilled.
  await page.goto('/admin/projects/prj_e2e_time?tab=time');
  await expect(page.getByRole('cell', { name: /Billed · draft/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bill unbilled time' })).toHaveCount(0);
});
