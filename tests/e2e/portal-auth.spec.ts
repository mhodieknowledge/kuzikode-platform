import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';
import { E2E_PASSWORD, E2E_PORTAL_USER, E2E_USERS } from './users';

test.use({ actionTimeout: 15_000 });

const hydrated = (page: Page, text: string) =>
  expect(page.locator('astro-island').filter({ hasText: text }).first()).not.toHaveAttribute('ssr');

async function portalSignIn(page: Page, email: string, password: string) {
  await page.goto('/portal/login');
  await hydrated(page, 'Sign in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

async function adminSignIn(page: Page, email: string) {
  await page.goto('/admin/login');
  await hydrated(page, 'Sign in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Turns self-registration on or off through the settings API, as the signed-in admin in `page`. */
async function setRegistration(page: Page, on: boolean) {
  const status = await page.evaluate(async (value) => {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const res = await fetch('/api/v1/admin/settings/sections/portal', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ 'portal.self_registration': value }),
    });
    return res.status;
  }, on);
  expect(status).toBe(200);
}

test('a client signs in, updates their details, sees their devices and signs out', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portal');
  await expect(page).toHaveURL(/\/portal\/login\?next=%2Fportal$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your portal' })).toBeVisible();
  await expect(page.getByText('Portal accounts are created by invitation')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'portal-login');

  await page.setViewportSize({ width: 1440, height: 900 });
  await portalSignIn(page, E2E_PORTAL_USER.email, E2E_PASSWORD);
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, Kuda' })).toBeVisible();
  await expect(page.getByText(E2E_PORTAL_USER.clientName).first()).toBeVisible();
  // Overview (P5.2): balance per currency with the overdue part, open quotation, active project, recent activity.
  const usd = page.getByTestId('portal-balance-USD');
  await expect(usd).toContainText('$1,450.00');
  await expect(usd).toContainText('2 open invoices');
  await expect(usd).toContainText('$250.00 overdue (1 invoice)');
  await expect(page.getByText('Online ordering website').first()).toBeVisible();
  await expect(page.getByText('QUO-E2E-P001').first()).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Brand refresh progress' })).toHaveAttribute(
    'aria-valuenow',
    '60',
  );
  await expect(page.getByText('Next: Logo sign-off')).toBeVisible();
  await expect(page.getByTestId('portal-activity')).toContainText('Update on Brand refresh');
  await expect(page.getByTestId('portal-activity')).toContainText('Invoice INV-E2E-P001 issued');
  await expectAccessible(page);
  await screenshots(page, 'portal-overview');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole('navigation', { name: 'Portal navigation' })
    .first()
    .getByRole('link', { name: 'Account' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  await hydrated(page, 'Save details');
  await page.getByLabel('Phone').fill('not a phone');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Enter a valid phone number.')).toBeVisible();
  await page.getByLabel('Name').fill('Kuda Client');
  await page.getByLabel('Phone').fill('+263 77 765 4321');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Your details have been saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Phone')).toHaveValue('+263 77 765 4321');
  await expectAccessible(page);
  await screenshots(page, 'portal-account');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'See signed-in devices' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'portal-sessions');

  await page.setViewportSize({ width: 1440, height: 900 });
  await hydrated(page, 'Kuda Client');
  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/portal\/login$/);
  await page.goto('/portal/account');
  await expect(page).toHaveURL(/\/portal\/login\?next=/);
});

test('optional self-registration: sign up, set a password, wait for staff to link the account', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await adminSignIn(page, E2E_USERS.portalAdmin.email);
  await setRegistration(page, true);
  try {
    const visitorContext = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const visitor = await visitorContext.newPage();
    await visitor.goto('/portal/login');
    await visitor.getByRole('link', { name: 'Create an account' }).click();
    await expect(visitor.getByRole('heading', { level: 1, name: 'Create a portal account' })).toBeVisible();
    await expectAccessible(visitor);
    await screenshots(visitor, 'portal-register');

    const email = `signup-${Date.now()}@example.com`;
    await hydrated(visitor, 'Create account');
    await visitor.getByLabel('Your name').fill('Farai Signup');
    await visitor.getByLabel('Company').fill('Borrowdale Florists');
    await visitor.getByLabel('Email').fill(email);
    await visitor.getByRole('button', { name: 'Create account' }).click();
    await expect(visitor.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    // The email reaches the development mailbox (the admin page can open it).
    await expect
      .poll(
        async () => {
          await page.goto('/admin/dev/mailbox');
          return page.getByRole('row').filter({ hasText: email }).count();
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
    await page.getByRole('row').filter({ hasText: email }).getByRole('link').first().click();
    const href = await page.getByRole('link', { name: 'Confirm email address' }).getAttribute('href');
    const link = new URL(href!);
    expect(link.pathname).toBe('/portal/accept-invite');
    await visitor.goto(`${link.pathname}${link.search}`);
    await hydrated(visitor, 'Create account');
    await visitor.locator('input[name="password"]').fill(E2E_PASSWORD);
    await visitor.getByLabel('Confirm new password').fill(E2E_PASSWORD);
    await visitor.getByRole('button', { name: 'Create account' }).click();
    await expect(visitor.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();

    await portalSignIn(visitor, email, E2E_PASSWORD);
    await expect(visitor.getByTestId('portal-unlinked')).toBeVisible();
    await expect(visitor.getByText(E2E_PORTAL_USER.clientName)).toHaveCount(0);
    await expectAccessible(visitor);
    await screenshots(visitor, 'portal-unlinked');

    // Staff see the sign-up and link it explicitly.
    await page.goto('/admin/clients');
    await page.getByRole('link', { name: /Portal sign-ups/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Portal sign-ups' })).toBeVisible();
    const row = page.getByRole('listitem').filter({ hasText: email });
    await expect(row).toContainText('Says they are from Borrowdale Florists');
    await expectAccessible(page);
    await hydrated(page, 'Link to a client');
    await row.getByRole('button', { name: /Link to a client/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Link Farai Signup to a client' });
    await dialog.getByLabel('Client').selectOption({ label: E2E_PORTAL_USER.clientName });
    await dialog.getByRole('button', { name: 'Link account' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: email })).toHaveCount(0);

    await visitor.reload();
    await expect(visitor.getByTestId('portal-unlinked')).toHaveCount(0);
    await expect(visitor.getByText(E2E_PORTAL_USER.clientName).first()).toBeVisible();
    await visitorContext.close();
  } finally {
    await page.goto('/admin');
    await setRegistration(page, false);
  }
  const anon = await page.request.get('/portal/register');
  expect(anon.status()).toBe(404);
});
