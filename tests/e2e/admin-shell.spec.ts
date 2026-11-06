import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

async function signIn(page: Page, email: string, next = '') {
  await page.goto(`/admin/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('protected admin pages redirect to sign-in and come back afterwards', async ({ page }) => {
  await page.goto('/admin/notifications');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fnotifications$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expectAccessible(page);
  await screenshots(page, 'admin-login');
  await signIn(page, E2E_USERS.admin.email, '/admin/notifications');
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
  // P4.16: All / Unread filter and a link to the preferences.
  const filters = page.getByRole('navigation', { name: 'Filter notifications' });
  await expect(filters.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
  await filters.getByRole('link', { name: /^Unread/ }).click();
  await expect(page).toHaveURL(/\/admin\/notifications\?filter=unread$/);
  await expect(filters.getByRole('link', { name: /^Unread/ })).toHaveAttribute('aria-current', 'page');
  await expectAccessible(page);
  await screenshots(page, 'admin-notifications');
  await expect(page.getByRole('link', { name: 'Preferences' })).toHaveAttribute('href', '/admin/account/notifications');
});

test('wrong password shows a generic error', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(E2E_USERS.support.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('sidebar shows only what the role may use (support staff vs administrator)', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.support.email);
  await expect(page).toHaveURL(/\/admin$/);
  const nav = page.getByRole('navigation', { name: 'Admin navigation' }).first();
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Invoices' })).toHaveCount(0);
  // No dead links: every rendered sidebar link resolves.
  for (const href of await nav.getByRole('link').evaluateAll((els) => els.map((e) => e.getAttribute('href')!))) {
    expect((await page.request.get(href)).status(), href).toBe(200);
  }
  await expectAccessible(page);
  await screenshots(page, 'admin-home');

  // ⌘K opens the palette and the quick links filter.
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Search' }).fill('dash');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Escape');

  // Account menu → signed-in devices → sign out.
  await page.getByRole('button', { name: /Account menu: Sam Support/ }).click();
  await page.getByRole('menuitem', { name: 'Signed-in devices' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();
  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);

  const ctx = await browser.newContext();
  const adminPage = await ctx.newPage();
  await signIn(adminPage, E2E_USERS.admin.email);
  await expect(adminPage).toHaveURL(/\/admin$/);
  await expect(adminPage.getByRole('heading', { level: 1 })).toHaveText('Welcome, Eva');
  await ctx.close();
});

test('a user who must change their password is sent to the password page first', async ({ page }) => {
  await signIn(page, E2E_USERS.newcomer.email);
  await expect(page).toHaveURL(/\/admin\/password$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/password$/);
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Current password').fill(E2E_PASSWORD);
  await page.getByLabel(/^New password/).fill('A-brand-new-passphrase-26');
  await page.getByLabel('Confirm new password').fill('A-brand-new-passphrase-26');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome, Nia');
});

test('mobile: navigation opens in a drawer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, E2E_USERS.admin.email);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Admin navigation' }).getByRole('link', { name: 'Dashboard' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await page.goto('/admin/account/security');
  await expect(page.getByRole('heading', { level: 2, name: 'Two-factor authentication' })).toBeVisible();
  await expectAccessible(page);
});

test('dashboard: KPI tiles, per-currency charts with a table view, lists (P4.17)', async ({ page }) => {
  await signIn(page, E2E_USERS.admin.email, '/admin');
  await expect(page).toHaveURL(/\/admin$/);
  const tiles = page.getByTestId('kpi-tiles');
  for (const label of [
    'Revenue received (all time)',
    'Revenue this month',
    'Outstanding',
    'Overdue',
    'Pending quotations',
  ])
    await expect(tiles.locator(`[data-tile="${label}"]`)).toBeVisible();
  await expect(page.getByText('Invoices issued vs paid per month')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent payments' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  const table = page.locator('figure').filter({ hasText: 'Invoices issued vs paid' }).locator('details');
  await table.locator('summary').click();
  await expect(table.getByRole('columnheader', { name: 'Paid' })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-dashboard');
  // Support staff: no financial tiles or charts.
  await page.context().clearCookies();
  await signIn(page, E2E_USERS.support.email, '/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Revenue received (all time)')).toHaveCount(0);
  await expect(page.getByText('Invoices issued vs paid per month')).toHaveCount(0);
});
