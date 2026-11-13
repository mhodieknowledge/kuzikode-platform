import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('packages'));

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

test('packages admin: tabs in comparison order, price review, create + delete a package, add-ons (P4.19)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.packagesAdmin.email);
  await page.goto('/admin/packages');
  await expect(page.getByRole('heading', { level: 1, name: 'Packages & pricing' })).toBeVisible();
  for (const tab of ['Websites', 'Care plans', 'Email & domains'])
    await expect(page.getByRole('heading', { level: 2, name: tab })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Business Website' })).toBeVisible();
  await expect(page.getByTestId('show-prices')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Add-ons' })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-packages');

  // A new, hidden package (never shown publicly), then deleted again.
  const name = `E2E Landing ${Date.now() % 100000}`;
  await page.goto('/admin/packages/new');
  await hydrated(page, 'Create package');
  await page.getByRole('textbox', { name: /^Name/ }).fill(name);
  await page.getByRole('textbox', { name: 'Price', exact: true }).fill('200');
  await page.getByRole('button', { name: 'Add feature' }).click();
  await page.getByRole('textbox', { name: /^Feature 1/ }).fill('Pages');
  await page.getByLabel('Shown as').selectOption('text');
  await page.getByRole('textbox', { name: /^Value/ }).fill('1');
  await expectAccessible(page);
  await screenshots(page, 'admin-package-editor');
  await page.getByRole('button', { name: 'Create package' }).click();
  await expect(page).toHaveURL(/\/admin\/packages\?saved=1$/);
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.getByRole('link', { name }).click();
  await hydrated(page, 'Save package');
  await expect(page.getByRole('textbox', { name: /^Feature 1/ })).toHaveValue('Pages');
  await page.getByRole('button', { name: 'Delete package' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete package' }).click();
  await expect(page).toHaveURL(/\/admin\/packages$/);
  await expect(page.getByRole('link', { name })).toHaveCount(0);

  // Review view.
  await page.getByRole('link', { name: /^Awaiting review/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Awaiting review' })).toBeVisible();
});

test('quotation editor: "Add package" inserts the package and add-ons as priced lines (P4.19)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.packagesAdmin.email);
  const n = Date.now() % 100000;
  await page.goto('/admin/clients/new');
  await hydrated(page, 'Create client');
  await page.getByLabel('Organisation name').fill(`Package Client ${n}`);
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Package Client ${n}` })).toBeVisible();
  await page.getByRole('link', { name: 'New quotation' }).click();
  await hydrated(page, 'Create draft');
  await page.getByRole('button', { name: 'Add package' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Package').selectOption('pkg_starter_website');
  await dialog.getByRole('checkbox', { name: /^Additional Website Pages/ }).check();
  await dialog.getByLabel('Quantity').fill('2');
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Add to quotation' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Line 1 description')).toHaveValue(/^Starter Website\nIncludes: /);
  await expect(page.getByLabel('Line 1 unit price')).toHaveValue('150.00');
  await expect(page.getByLabel('Line 2 description')).toHaveValue(/^Additional Website Pages \(per page\)/);
  await expect(page.getByLabel('Line 2 quantity')).toHaveValue('2');
  await screenshots(page, 'admin-quotation-add-package');
});
