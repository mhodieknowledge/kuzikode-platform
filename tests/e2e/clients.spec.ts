import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('clients'));

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

test('admin creates a client with a main contact, adds a note, invites the contact and archives/restores', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.clientsAdmin.email);
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .first()
    .getByRole('link', { name: 'Clients' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
  await page.getByRole('link', { name: 'New client' }).click();
  await hydrated(page, 'Create client');
  const name = `Chimanimani Tours ${Date.now() % 100000}`;
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page.getByText('Enter a name.')).toBeVisible();
  await page.getByLabel('Organisation name').fill(name);
  await page.getByLabel('Email', { exact: true }).fill('bookings@chimanimani.example');
  await page.getByLabel('Tags').fill('tourism, priority');
  await page.getByLabel('City').fill('Mutare');
  await page.getByLabel('Contact name').fill('Farai Dube');
  await page.getByLabel('Contact email').fill(`farai-${Date.now()}@chimanimani.example`);
  await expectAccessible(page);
  await screenshots(page, 'admin-client-new');
  await page.getByRole('button', { name: 'Create client' }).click();

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText(/CL-\d{4,}/)).toBeVisible();
  await expect(page.getByText('Mutare')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-client-detail');

  await page.getByRole('link', { name: /^Notes/ }).click();
  await hydrated(page, 'Add note');
  await page.getByLabel('Add a note').fill('Prefers to pay by EcoCash.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Prefers to pay by EcoCash.')).toBeVisible();

  await page.getByRole('link', { name: /^Contacts/ }).click();
  await expect(page.getByRole('button', { name: 'Edit Farai Dube' })).toBeVisible();
  await expect(page.getByText('Main', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Portal access' }).click();
  await hydrated(page, 'Invite to the portal');
  await page.getByRole('button', { name: 'Invite to the portal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite to the client portal' });
  await dialog.getByLabel('Contact').selectOption({ index: 1 }); // the only contact with an email
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText(/Invitation sent/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Billing|Member|Owner/).first()).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('link', { name: 'Overview' }).click();
  await hydrated(page, 'Archive');
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive client' }).click();
  await expect(page.getByText(/· Archived/)).toBeVisible();
  await hydrated(page, 'Restore');
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText(/· Archived/)).toHaveCount(0);

  await page.goto(`/admin/clients?q=${encodeURIComponent(name)}&tag=tourism`);
  await expect(page.getByRole('link', { name })).toBeVisible();
});

test('support staff can view clients but not create or change them', async ({ page }) => {
  await signIn(page, E2E_USERS.support2.email);
  await page.goto('/admin/clients');
  await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New client' })).toHaveCount(0);
  expect((await page.goto('/admin/clients/new'))!.status()).toBe(403);
});
