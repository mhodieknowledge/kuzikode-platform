import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';
import { E2E_PASSWORD, E2E_PORTAL_SUPPORT_USER, E2E_PORTAL_USER, E2E_USERS } from './users';

test.use({ actionTimeout: 15_000 });

/** Waits for an island to hydrate; `client:visible` islands below the fold only hydrate once scrolled into view. */
async function hydrated(page: Page, text: string) {
  const island = page.locator('astro-island').filter({ hasText: text }).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr');
}

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
  await expect(page.getByRole('main').getByText(E2E_PORTAL_USER.clientName)).toBeVisible();
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
    await expect(visitor.getByRole('main').getByText(E2E_PORTAL_USER.clientName)).toBeVisible();
    await visitorContext.close();
  } finally {
    await page.goto('/admin');
    await setRegistration(page, false);
  }
  const anon = await page.request.get('/portal/register');
  expect(anon.status()).toBe(404);
});

test('a client opens a quotation, reads it and accepts it with their name (P5.3)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await portalSignIn(page, E2E_PORTAL_USER.email, E2E_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Portal navigation' })
    .first()
    .getByRole('link', { name: 'Quotations' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Quotations' })).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: 'QUO-E2E-P001' });
  await expect(row).toContainText('Waiting for your answer');
  await expect(row).toContainText('$2,500.00');
  await expectAccessible(page);
  await screenshots(page, 'portal-quotations');

  await page.setViewportSize({ width: 1440, height: 900 });
  await row.getByRole('link', { name: 'Online ordering website' }).click();
  await expect(page).toHaveURL(/\/portal\/quotations\/quo_e2e_portal_1$/);
  await expect(page.getByRole('cell', { name: 'Online ordering website with EcoCash checkout' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
    'href',
    '/api/v1/portal/quotations/quo_e2e_portal_1/pdf',
  );
  await expectAccessible(page);
  await screenshots(page, 'portal-quotation');

  await page.setViewportSize({ width: 1440, height: 900 });
  await hydrated(page, 'Accept quotation');
  await page.getByLabel(/Your full name/).fill('Kuda Client');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Accept quotation' }).click();
  await expect(page.getByText('Accepted by Kuda Client')).toBeVisible();
  await page.goto('/portal/quotations?show=open');
  await expect(page.getByText('No quotations are waiting for your answer.')).toBeVisible();
});

test('a client sees what they owe, opens an overdue invoice and finds how to pay (P5.4)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await portalSignIn(page, E2E_PORTAL_USER.email, E2E_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Portal navigation' })
    .first()
    .getByRole('link', { name: 'Invoices' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Invoices' })).toBeVisible();
  const overdue = page.getByRole('listitem').filter({ hasText: 'INV-E2E-P002' });
  await expect(overdue).toContainText('Overdue');
  await expect(overdue).toContainText('$250.00');
  await expect(overdue).toContainText('of $450.00');
  await expect(page.getByRole('listitem').filter({ hasText: 'INV-E2E-P001' })).toContainText('Due');
  await expectAccessible(page);
  await screenshots(page, 'portal-invoices');

  await page.setViewportSize({ width: 1440, height: 900 });
  await overdue.getByRole('link', { name: 'INV-E2E-P002' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'INV-E2E-P002' })).toBeVisible();
  await expect(page.getByTestId('portal-how-to-pay')).toContainText('$250.00 to pay');
  await expect(page.getByTestId('portal-how-to-pay')).toContainText('was due');
  await expect(page.getByRole('cell', { name: 'Website care plan (3 months)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
    'href',
    '/api/v1/portal/invoices/inv_e2e_portal_2/pdf',
  );
  await expectAccessible(page);
  await screenshots(page, 'portal-invoice');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portal/invoices?show=credit-notes');
  await expect(page.getByText('There are no credit notes.')).toBeVisible();
});

test('a client sees their payments with receipts and the status of a failed online attempt (P5.5)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await portalSignIn(page, E2E_PORTAL_USER.email, E2E_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Portal navigation' })
    .first()
    .getByRole('link', { name: 'Payments' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Payments' })).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: 'RCT-E2E-P001' });
  await expect(row).toContainText('Bank transfer');
  await expect(row).toContainText('INV-E2E-P002');
  await expect(row).toContainText('$200.00');
  await expect(row.getByRole('link', { name: /Receipt/ })).toHaveAttribute(
    'href',
    '/api/v1/portal/payments/pay_e2e_portal_1/receipt',
  );
  const receipt = await page.request.get('/api/v1/portal/payments/pay_e2e_portal_1/receipt');
  expect(receipt.status()).toBe(200);
  expect(receipt.headers()['content-type']).toBe('application/pdf');
  await expectAccessible(page);
  await screenshots(page, 'portal-payments');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portal/payments/attempts/pat_e2e_portal_failed');
  await expect(page.getByRole('heading', { name: 'Payment not completed' })).toBeVisible();
  await expect(page.getByText('Nothing was taken from your account.')).toBeVisible();
  await expect(page.getByText('EcoCash · 077****111')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'portal-attempt');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Back to invoice INV-E2E-P002' }).click();
  await expect(page).toHaveURL(/\/portal\/invoices\/inv_e2e_portal_2$/);
});

test('a client follows a project and writes to the team (P5.6)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await portalSignIn(page, E2E_PORTAL_USER.email, E2E_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Portal navigation' })
    .first()
    .getByRole('link', { name: 'Projects' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Brand refresh progress' })).toHaveAttribute(
    'aria-valuenow',
    '60',
  );
  await expectAccessible(page);
  await screenshots(page, 'portal-projects');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Brand refresh' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Brand refresh' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Milestones' })).toContainText('Logo sign-off');
  await expect(page.getByTestId('project-updates')).toContainText(
    'The first logo concepts are ready for your feedback.',
  );
  await expect(page.getByText('Files the team shares with you appear here.')).toBeVisible();

  const text = `We like concept B best (${Date.now()}).`;
  await hydrated(page, 'Send message');
  await page.getByLabel('Message to the Kuzikode team').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('project-messages')).toContainText(text);
  await expectAccessible(page);
  await screenshots(page, 'portal-project');
});

test('a client opens a support request with a file, replies, and asks to cancel a service (P5.7)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await portalSignIn(page, E2E_PORTAL_SUPPORT_USER.email, E2E_PASSWORD);
  const nav = page.getByRole('navigation', { name: 'Portal navigation' }).first();
  await nav.getByRole('link', { name: 'Support' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible();
  await expect(page.getByText('You have not asked for help yet.')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'portal-support');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'New request' }).click();
  await hydrated(page, 'Send request');
  await page.getByLabel('Subject').fill('Contact form is not sending');
  await page.getByLabel('What is it about?').selectOption('website');
  await page.getByLabel('How can we help?').fill('The contact form shows an error when I press Send.');
  await page.getByLabel('Attachments (optional)').setInputFiles('tests/e2e/fixtures/brief.pdf');
  await expectAccessible(page);
  await screenshots(page, 'portal-support-new');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL(/\/portal\/support\/sup_/);
  await expect(page.getByRole('heading', { level: 1, name: 'Contact form is not sending' })).toBeVisible();
  const thread = page.getByTestId('support-thread');
  await expect(thread).toContainText('The contact form shows an error');
  await expect(thread.getByRole('link', { name: 'brief.pdf' })).toBeVisible();

  await hydrated(page, 'Send message');
  await page.getByLabel('Your message').fill('It happens on mobile too.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(thread).toContainText('It happens on mobile too.');
  await page.getByRole('button', { name: 'Mark as resolved' }).click();
  await expect(page.getByText('Resolved', { exact: true })).toBeVisible();
  await expect(page.getByText('Sending a message reopens this request.')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'portal-support-request');

  await page.setViewportSize({ width: 1440, height: 900 });
  await nav.getByRole('link', { name: 'Services' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your services' })).toBeVisible();
  await expect(page.getByTestId('assets')).toContainText('e2e-portal-client.co.zw');
  await expectAccessible(page);
  await screenshots(page, 'portal-services');
  await page.setViewportSize({ width: 1440, height: 900 });
  await hydrated(page, 'Request cancellation');
  await page.getByRole('button', { name: 'Request cancellation of Website care plan' }).click();
  await page.getByLabel('Reason (optional)').fill('We are moving the site in-house.');
  await page.getByRole('button', { name: 'Send cancellation request' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cancellation request: Website care plan' })).toBeVisible();
  await expect(page.getByTestId('support-thread')).toContainText('We are moving the site in-house.');
  await page.goto('/portal/services');
  await expect(page.getByText('Cancellation requested.')).toBeVisible();
});
