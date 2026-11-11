import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('services'));

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

test('content manager adds a division and a service, sees them on the website, reorders, then deletes them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const n = Date.now() % 100000;
  const name = `Workshops ${n}`;
  const slug = `workshops-${n}`;
  await signIn(page, E2E_USERS.servicesAdmin.email);
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .first()
    .getByRole('link', { name: 'Services' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-services');

  await page.getByRole('link', { name: 'New division' }).click();
  await hydrated(page, 'Create division');
  await page.getByRole('button', { name: 'Create division' }).click();
  await expect(page.getByText('Enter a name.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await expect(page.getByText(`/services/${slug}`)).toBeVisible();
  await page.getByLabel('Status').selectOption('active');
  await page
    .getByRole('textbox', { name: 'Summary', exact: true })
    .fill('Hands-on training for teams adopting new systems.');
  await page.getByRole('textbox', { name: 'Description', exact: true }).click();
  await page.keyboard.type('Practical sessions using your own data.');
  await page.getByRole('button', { name: 'Add benefit' }).click();
  await page.getByLabel('Benefit 1 title').fill('Learn by doing');
  await page.getByLabel('Benefit 1 description').fill('Every exercise uses real examples.');
  await expectAccessible(page);
  await screenshots(page, 'admin-division-form');
  await page.getByRole('button', { name: 'Create division' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  await hydrated(page, 'Add service');
  await page.getByRole('link', { name: `Add service to ${name}` }).click();
  await hydrated(page, 'Create service');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Dashboard basics');
  await page.getByLabel('Status').selectOption('active');
  await page
    .getByRole('textbox', { name: 'Summary', exact: true })
    .fill('A one-day introduction to dashboards for managers.');
  await page.getByLabel('Pricing model').selectOption('fixed');
  await page.getByLabel('Price').fill('150');
  await page.getByRole('button', { name: 'Create service' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  // Live on the public site straight away.
  await page.goto(`/services/${slug}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('Practical sessions using your own data.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard basics' })).toBeVisible();
  await expect(page.getByText('Learn by doing')).toBeVisible();

  // Reorder with the keyboard-friendly buttons (and back).
  await page.goto('/admin/services');
  await hydrated(page, 'Divisions');
  await page.getByRole('button', { name: `Move ${name} up` }).click();
  await expect(page.getByRole('status').filter({ hasText: `${name} moved to position` })).toBeAttached();
  await page.reload();
  const order = page.getByRole('list', { name: 'Divisions' }).getByRole('listitem');
  await expect(order.nth((await order.count()) - 2)).toContainText(name);
  await hydrated(page, 'Divisions');
  await page.getByRole('button', { name: `Move ${name} down` }).click();
  await expect(page.getByRole('status').filter({ hasText: `${name} moved to position` })).toBeAttached();

  // Clean up: delete the unused service, then the empty division.
  await page
    .getByRole('list', { name: `${name} services` })
    .getByRole('link', { name: 'Dashboard basics' })
    .click();
  await hydrated(page, 'Delete service');
  await page.getByRole('button', { name: 'Delete service' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete service' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
  await page.getByRole('link', { name, exact: true }).click();
  await hydrated(page, 'Delete division');
  await page.getByRole('button', { name: 'Delete division' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete division' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
  expect((await page.request.get(`/services/${slug}`)).status()).toBe(404);
});
