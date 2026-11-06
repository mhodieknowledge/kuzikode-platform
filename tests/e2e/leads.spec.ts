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
  expect(page.locator('astro-island').filter({ hasText: text }).last()).not.toHaveAttribute('ssr', { timeout: 10_000 });

test('enquiry → lead → activity and follow-up → convert to client (docs/08 flows 2–3)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.leadsAdmin.email);
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .first()
    .getByRole('link', { name: 'Enquiries' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Enquiries' })).toBeVisible();
  await page.getByLabel('Search').fill('ENQ-E2E-0001');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expectAccessible(page);
  await screenshots(page, 'admin-enquiries');
  await page.getByRole('link', { name: /Tendai Moyo/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Tendai Moyo' })).toBeVisible();
  await expect(page.getByText('online shop for our bakery')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-enquiry-detail');
  await hydrated(page, 'Create lead');
  await page.getByRole('button', { name: 'Create lead' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Assign to')).toHaveValue(E2E_USERS.leadsAdmin.id);
  await dialog.getByRole('button', { name: 'Create lead' }).click();

  await expect(page.getByRole('heading', { level: 1, name: /^Harare Bakery: / })).toBeVisible();
  await expect(page.getByText('Created from enquiry ENQ-E2E-0001.')).toBeVisible();
  await expect(page.getByText('Lena Leads').first()).toBeVisible();

  // Log a call, then schedule and complete a follow-up.
  await hydrated(page, 'Add to log');
  await page.getByRole('textbox', { name: 'Details' }).fill('Called Tendai: wants delivery slots by suburb.');
  await page.getByRole('button', { name: 'Add to log' }).click();
  await expect(page.getByText('Called Tendai: wants delivery slots by suburb.')).toBeVisible();
  await hydrated(page, 'Add to log');
  await page.getByLabel('Type').selectOption('follow_up');
  await page.getByLabel('Follow up on').fill('2026-01-05');
  await page.getByLabel('What to do').fill('Send the e-commerce proposal.');
  await page.getByRole('button', { name: 'Schedule follow-up' }).click();
  const open = page.getByRole('region', { name: 'Open follow-ups' });
  await expect(open.getByText('Send the e-commerce proposal.')).toBeVisible();
  await expect(open.getByText(/Overdue since/)).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-lead-detail');
  await hydrated(page, 'Mark done');
  await open.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('region', { name: 'Open follow-ups' })).toHaveCount(0);

  // Move the stage via edit (records a stage change).
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await hydrated(page, 'Save changes');
  await page.getByLabel('Stage').selectOption('qualified');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('New → Qualified')).toBeVisible();

  // The board shows the lead under Qualified.
  await page.goto('/admin/leads?view=board&q=Harare+Bakery');
  await expect(
    page
      .getByRole('region', { name: /^Qualified/ })
      .getByRole('link', { name: /^Harare Bakery: / })
      .first(),
  ).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-leads-board');
  await page
    .getByRole('region', { name: /^Qualified/ })
    .getByRole('link', { name: /^Harare Bakery: / })
    .first()
    .click();

  // Convert to a client.
  await hydrated(page, 'Convert to client');
  await page.getByRole('button', { name: 'Convert to client' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Convert to client' }).click();
  await expect(page).toHaveURL(/\/admin\/clients\/cli_/);
  await expect(page.getByRole('heading', { level: 1, name: 'Harare Bakery' })).toBeVisible();
  await expect(page.getByText(/CL-\d{4,}/)).toBeVisible();
});

test('a lead can be added by hand and validation errors are shown', async ({ page }) => {
  await signIn(page, E2E_USERS.leadsAdmin.email);
  await page.goto('/admin/leads/new');
  await hydrated(page, 'Create lead');
  await page.getByRole('button', { name: 'Create lead' }).click();
  await expect(page.getByText('Give the lead a title.')).toBeVisible();
  const title = `Masvingo Lodge ${Date.now() % 100000}: booking system`;
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Stage').selectOption('lost');
  await page.getByRole('button', { name: 'Create lead' }).click();
  await expect(page.getByText('Say why the lead was lost.')).toBeVisible();
  await page.getByLabel('Why was it lost?').fill('Chose an existing booking platform.');
  await page.getByLabel('Estimated value').fill('2500');
  await page.getByLabel('Contact name').fill('Rumbi Chari');
  await page.getByRole('button', { name: 'Create lead' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('Chose an existing booking platform.')).toBeVisible();
  await expect(page.getByText(/2,500\.00/)).toBeVisible();
  // Lost leads can't be converted.
  await expect(page.getByRole('button', { name: 'Convert to client' })).toHaveCount(0);
});
