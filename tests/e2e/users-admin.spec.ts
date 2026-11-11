import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('users-admin'));

async function signIn(page: Page, email: string) {
  await page.goto('/admin/login');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('administrator invites a staff member and changes their roles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.usersAdmin.email);
  await page.getByRole('navigation', { name: 'Admin navigation' }).first().getByRole('link', { name: 'Users' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-users');

  const email = `invitee-${Date.now()}@example.com`;
  await expect(page.locator('astro-island:has(button)').filter({ hasText: 'Invite staff member' })).not.toHaveAttribute(
    'ssr',
  );
  await page.getByRole('button', { name: 'Invite staff member' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite a staff member' });
  await dialog.getByLabel('Full name').fill('Tino Invitee');
  await dialog.getByLabel('Work email').fill(email);
  await expect(dialog.getByRole('checkbox', { name: 'Super Administrator' })).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: 'Support Staff' }).check();
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tino Invitee' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend invitation' })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-user-detail');

  await page.getByRole('checkbox', { name: 'Project Manager' }).check();
  await page.getByRole('button', { name: 'Save roles' }).click();
  await expect(page.getByText('Roles changed')).toBeVisible();

  await page.goto('/admin/users/roles');
  await expect(page.getByRole('table', { name: 'Which roles hold each permission' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New custom role' })).toHaveCount(0); // admins can't manage roles
  await expectAccessible(page);
});

test('support staff cannot open the users area', async ({ page }) => {
  await signIn(page, E2E_USERS.support2.email);
  const res = await page.goto('/admin/users');
  expect(res!.status()).toBe(403);
  await expect(page.getByRole('heading', { name: "You don't have access to this page" })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute('href', '/admin');
});
