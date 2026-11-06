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

test('subscription + managed service: create, preview next invoice, pause; register with renewals calendar (P4.20)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.subscriptionsAdmin.email);
  const n = Date.now() % 100000;
  const clientName = `Subscription Client ${n}`;
  await page.goto('/admin/clients/new');
  await hydrated(page, 'Create client');
  await page.getByLabel('Organisation name').fill(clientName);
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page.getByRole('heading', { level: 1, name: clientName })).toBeVisible();
  const clientUrl = page.url();
  const clientId = clientUrl.split('/').pop()!;

  await page.goto(`/admin/subscriptions/new?client=${clientId}`);
  await hydrated(page, 'Create subscription');
  await page.getByRole('textbox', { name: /^Description/ }).fill('Business Email, 10 mailboxes');
  await page.getByRole('textbox', { name: /^Quantity/ }).fill('10');
  await page.getByRole('textbox', { name: /^Unit price/ }).fill('3');
  await expectAccessible(page);
  await screenshots(page, 'admin-subscription-editor');
  await page.getByRole('button', { name: 'Create subscription' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Business Email, 10 mailboxes' })).toBeVisible();
  await expect(page.getByTestId('next-invoice')).toContainText('$30.00');
  await expectAccessible(page);
  await screenshots(page, 'admin-subscription-detail');
  await hydrated(page, 'Pause billing');
  await page.getByRole('button', { name: 'Pause billing' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();

  await page.goto('/admin/subscriptions?status=all');
  await expect(page.getByRole('link', { name: 'Business Email, 10 mailboxes' }).first()).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-subscriptions');

  // Register: a domain renewing in ~20 days shows in the calendar and on the client's Services tab.
  const renew = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const domain = `msasa-${n}.co.zw`;
  await page.goto(`/admin/assets/new?client=${clientId}`);
  await hydrated(page, 'Add to register');
  await page.getByRole('textbox', { name: /^Name/ }).fill(domain);
  await page.getByRole('textbox', { name: /^Provider/ }).fill('ZISPA');
  await page.getByLabel('Renewal date').fill(renew);
  await page.getByLabel('Where the credentials are kept').fill('password: secret123');
  await page.getByRole('button', { name: 'Add to register' }).click();
  await expect(page.getByText(/Never store passwords here/).first()).toBeVisible();
  await page.getByLabel('Where the credentials are kept').fill("In the owner's password manager");
  await page.getByRole('button', { name: 'Add to register' }).click();
  await expect(page).toHaveURL(/\/admin\/assets\?saved=1$/);
  const calendar = page.getByRole('region', { name: 'Renewals in the next 90 days' });
  await expect(calendar.getByRole('link', { name: domain })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-assets');
  await page.goto(`${clientUrl}?tab=services`);
  await expect(page.getByRole('link', { name: domain })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Business Email, 10 mailboxes' })).toBeVisible();
});
