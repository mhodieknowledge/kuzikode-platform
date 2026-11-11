/**
 * P7.1 — the owner's 16-step journey (docs/08 §4) in one serial spec, on the mock gateway and the log email adapter:
 * enquiry → lead → client → quotation → acceptance → invoice → portal invitation → part payment → online payment →
 * receipts → dashboard → project → client sees the project and downloads the deliverable.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectAccessible, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('full-journey'));

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.use({ actionTimeout: 15_000 });

const n = Date.now() % 1_000_000;
const person = `Nyasha Journey${n}`;
const org = `Kariba Journey Lodge ${n}`;
const email = `nyasha-${n}@journey.example`;
const quoteTitle = `Booking website ${n}`;
const clientPassword = `${E2E_PASSWORD}-client`;

const hydrated = (page: Page, text: string) =>
  expect(page.locator('astro-island').filter({ hasText: text }).last()).not.toHaveAttribute('ssr', { timeout: 10_000 });

async function adminSignIn(page: Page) {
  await page.goto('/admin/login');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(E2E_USERS.journeyAdmin.email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Opens the newest dev-mailbox email to `to` whose subject matches, and returns that email's page. */
async function openMail(page: Page, to: string, subject: RegExp) {
  const row = () => page.getByRole('row').filter({ hasText: to }).filter({ hasText: subject });
  await expect
    .poll(
      async () => {
        await page.goto('/admin/dev/mailbox');
        return row().count();
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await row().first().getByRole('link').first().click();
}

async function newContext(browser: Browser, page: Page) {
  const ctx = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 1440, height: 900 } });
  return ctx.newPage();
}

test('the 16-step journey: enquiry to paid invoice and delivered project (docs/08 §4)', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. A visitor sends an enquiry and sees its reference.
  await page.goto('/contact');
  await hydrated(page, 'Send message');
  await page.getByLabel('Your name').fill(person);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Organisation').fill(org);
  await page.getByLabel('What is this about?').selectOption({ label: 'Project quotation' });
  await page.getByLabel('Message').fill('We need a booking website for our lodge, with online deposits.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send message' }).click();
  const done = page.getByRole('status').filter({ hasText: 'Thank you. We have your message.' });
  await expect(done).toBeVisible();
  const enquiryRef = (await done.textContent())!.match(/ENQ-\d{4}-\d{4}/)![0];

  // 2. Admin signs in: a notification for the enquiry; triage it into a lead and log a note.
  await adminSignIn(page);
  await page.goto('/admin/notifications');
  await expect(page.getByText(new RegExp(`${enquiryRef}|${person}`)).first()).toBeVisible();
  await page.goto(`/admin/enquiries?q=${enquiryRef}`);
  await page
    .getByRole('link', { name: new RegExp(person) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: person })).toBeVisible();
  await hydrated(page, 'Create lead');
  await page.getByRole('button', { name: 'Create lead' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create lead' }).click();
  await expect(page.getByText(`Created from enquiry ${enquiryRef}.`)).toBeVisible();
  await hydrated(page, 'Add to log');
  await page.getByRole('textbox', { name: 'Details' }).fill('Called: 12 rooms, deposits by EcoCash.');
  await page.getByRole('button', { name: 'Add to log' }).click();
  await expect(page.getByText('Called: 12 rooms, deposits by EcoCash.')).toBeVisible();

  // 3. The lead becomes a client.
  await hydrated(page, 'Convert to client');
  await page.getByRole('button', { name: 'Convert to client' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Convert to client' }).click();
  await expect(page).toHaveURL(/\/admin\/clients\/cli_/);
  await expect(page.getByRole('heading', { level: 1, name: org })).toBeVisible();
  const clientUrl = page.url();

  // 4. A quotation with 3 lines, an overall discount and tax, sent by email.
  await page.getByRole('link', { name: 'New quotation' }).click();
  await hydrated(page, 'Create draft');
  await page.getByLabel('Title').fill(quoteTitle);
  await page.getByLabel('Line 1 description').fill('Website design and build');
  await page.getByLabel('Line 1 unit price').fill('900');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Line 2 description').fill('Room photography edits');
  await page.getByLabel('Line 2 quantity').fill('20');
  await page.getByLabel('Line 2 unit price').fill('5');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Line 3 description').fill('Hosting, first year');
  await page.getByLabel('Line 3 unit price').fill('120');
  await page.getByLabel('Line 3 tax').selectOption('tax_vat');
  await page.getByLabel('Overall discount', { exact: true }).selectOption('percent');
  await page.getByLabel('Overall discount percent').fill('5');
  await expect(page.locator('dl[aria-live="polite"]')).toContainText('$1,081.67');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('heading', { level: 1, name: quoteTitle })).toBeVisible();
  await hydrated(page, 'Send to client');
  await page.getByRole('button', { name: 'Send to client' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send quotation' }).click();
  const quoteNumber = (await page
    .getByText(/^QUO-\d{4}-\d{4}$/)
    .first()
    .textContent())!.trim();
  const quotationUrl = page.url();
  await openMail(page, email, new RegExp(`Quotation ${quoteNumber}`));
  const quoteLink = new URL((await page.getByRole('link', { name: 'View quotation' }).getAttribute('href'))!);
  expect(quoteLink.pathname).toMatch(/^\/q\/[A-Za-z0-9_-]+$/);

  // 5. The client opens /q/:token, downloads the PDF and accepts.
  const visitor = await newContext(browser, page);
  await visitor.goto(quoteLink.pathname);
  await expect(visitor.getByRole('heading', { level: 1, name: quoteTitle })).toBeVisible();
  const qpdf = await visitor.request.get(
    (await visitor.getByRole('link', { name: 'Download PDF' }).getAttribute('href'))!,
  );
  expect((await qpdf.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  await hydrated(visitor, 'Accept quotation');
  await visitor.getByLabel('Your full name').fill(person);
  await visitor.getByRole('checkbox').check();
  await visitor.getByRole('button', { name: 'Accept quotation' }).click();
  await expect(visitor.getByRole('status').filter({ hasText: 'You have accepted this quotation.' })).toBeVisible();
  await visitor.context().close();

  // 6. Admin converts the quotation to an invoice (once) and issues it.
  await page.goto(quotationUrl);
  await hydrated(page, 'Convert to invoice');
  await page.getByRole('button', { name: 'Convert to invoice' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Converted to a draft invoice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Convert to invoice' })).toHaveCount(0);
  const convertAgain = await page.request.post(`/api/v1/admin/quotations/${quotationUrl.split('/').pop()}/convert`, {
    headers: { 'x-csrf-token': await csrf(page), origin: new URL(page.url()).origin },
    data: {},
  });
  expect([200, 409]).toContain(convertAgain.status());
  await page.getByRole('link', { name: 'Open the invoice' }).click();
  await hydrated(page, 'Issue invoice');
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page.getByText(/^INV-\d{4}-\d{5}$/).first()).toBeVisible();
  const invoiceNumber = (await page
    .getByText(/^INV-\d{4}-\d{5}$/)
    .first()
    .textContent())!.trim();
  const invoiceUrl = page.url();
  const invoiceId = invoiceUrl.split('/').pop()!;
  expect(
    await page.request
      .get(`/api/v1/admin/invoices?q=${quoteNumber}`)
      .then((r) => r.json())
      .then((j: { data: { items: { number: string | null }[] } }) => j.data.items.filter((i) => i.number).length),
  ).toBeLessThanOrEqual(1);

  // 7. The invoice email has the /i/ link and the portal link.
  await openMail(page, email, new RegExp(`Invoice ${invoiceNumber}`));
  const invoiceLink = (await page.getByRole('link', { name: 'View invoice' }).getAttribute('href'))!;
  expect(invoiceLink).toMatch(/\/i\/[A-Za-z0-9_-]+$/);
  await expect(page.getByText(`/portal/invoices/${invoiceId}`)).toBeVisible();

  // 8. Admin invites the contact; the client accepts, sets a password and signs in to the portal.
  await page.goto(clientUrl);
  await page.getByRole('link', { name: 'Portal access' }).click();
  await hydrated(page, 'Invite to the portal');
  await page.getByRole('button', { name: 'Invite to the portal' }).click();
  const invite = page.getByRole('dialog', { name: 'Invite to the client portal' });
  await invite.getByLabel('Contact').selectOption({ index: 1 });
  await invite.getByLabel('Access').selectOption('owner'); // the main contact: invoices, payments and projects
  await invite.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText(/Invitation sent/).first()).toBeVisible();
  await openMail(page, email, /Your Kuzikode client portal account/);
  const inviteLink = new URL((await page.getByRole('link', { name: 'Set up your account' }).getAttribute('href'))!);
  const client = await newContext(browser, page);
  await client.goto(`${inviteLink.pathname}${inviteLink.search}`);
  await hydrated(client, 'Create account');
  await client.locator('input[name="password"]').fill(clientPassword);
  await client.getByLabel('Confirm new password').fill(clientPassword);
  await client.getByRole('button', { name: 'Create account' }).click();
  await expect(client.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();
  await client.goto('/portal/login');
  await hydrated(client, 'Sign in');
  await client.getByLabel('Email').fill(email);
  await client.getByLabel('Password').fill(clientPassword);
  await client.getByRole('button', { name: 'Sign in' }).click();
  await expect(client).toHaveURL(/\/portal$/);

  // 9. The client views the invoice and downloads its PDF.
  await client.goto(`/portal/invoices/${invoiceId}`);
  await expect(client.getByRole('heading', { level: 1, name: invoiceNumber })).toBeVisible();
  const ipdf = await client.request.get(
    (await client.getByRole('link', { name: 'Download PDF' }).getAttribute('href'))!,
  );
  expect(ipdf.status()).toBe(200);
  expect((await ipdf.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(ipdf.headers()['content-disposition']).toContain(`${invoiceNumber}.pdf`);

  // 10–12. Part paid by bank transfer (recorded by finance), then the rest online: confirmed only after verification.
  await page.goto(invoiceUrl);
  await hydrated(page, 'Record payment');
  await page.getByRole('button', { name: 'Record payment' }).click();
  const payDialog = page.getByRole('dialog');
  await payDialog.getByLabel('Amount received (USD)').fill('500');
  await payDialog.getByLabel('Reference').fill(`FT-${n}`);
  await payDialog.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Partially paid ·')).toBeVisible();

  await client.reload();
  await expect(client.getByText('Part paid').first()).toBeVisible();
  await client.getByRole('link', { name: 'Pay now' }).click();
  await expect(client).toHaveURL(new RegExp(`/portal/invoices/${invoiceId}/pay$`));
  await expect(client.locator('astro-island').filter({ hasText: 'Choose how to pay' })).not.toHaveAttribute('ssr');
  await expect(client.getByTestId('amount-due')).toHaveText('$581.67');
  await client.getByText('EcoCash', { exact: true }).click();
  await client.getByLabel('EcoCash number').fill('0771111111');
  await client.getByRole('button', { name: 'Pay $581.67' }).click();
  // Not "paid" on the click: we wait for the gateway, then confirm with a server-side status check.
  await expect(client.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
  await expect(client.getByRole('heading', { name: 'Payment received' })).toBeVisible({ timeout: 30_000 });
  await expectAccessible(client);

  await client.goto(`/portal/invoices/${invoiceId}`);
  await expect(client.getByText('Paid', { exact: true }).first()).toBeVisible();
  await expect(client.getByRole('link', { name: 'Pay now' })).toHaveCount(0);
  await page.goto(invoiceUrl);
  await expect(page.getByText('Paid ·')).toBeVisible();
  await expect(page.getByRole('link', { name: /^RCT-\d{4}-\d{5}$/ })).toHaveCount(2);

  // 13. Both receipts download from the portal.
  await client.goto('/portal/payments');
  const receipts = client.getByRole('link', { name: /^Receipt/ });
  await expect(receipts).toHaveCount(2);
  for (const href of await receipts.evaluateAll((els) => els.map((e) => e.getAttribute('href')!))) {
    const r = await client.request.get(href);
    expect(r.status()).toBe(200);
    expect((await r.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }

  // 14. Dashboard and payments list reflect it; the online payment shows its gateway reference.
  await page.goto('/admin');
  await expect(page.getByTestId('kpi-tiles').locator('[data-tile="Revenue this month"]')).toContainText('$');
  await expect(page.getByRole('link', { name: org }).first()).toBeVisible();
  await page.goto(`/admin/payments?q=${encodeURIComponent(org)}`);
  await expect(page.getByRole('link', { name: /^RCT-\d{4}-\d{5}$/ })).toHaveCount(2);
  await expect(page.getByText(/^mock_att_/)).toBeVisible();
  await expect(page.getByText(`FT-${n}`)).toBeVisible();

  // 15. A project from the quotation: client-visible milestone, an update and a deliverable file.
  await page.goto(quotationUrl);
  await hydrated(page, 'Create project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText(/^PRJ-\d{4}-\d{4}$/).first()).toBeVisible();
  await hydrated(page, 'Add milestone');
  await page.getByRole('button', { name: 'Add milestone' }).click();
  await page.getByLabel('Milestone title').fill('Design sign-off');
  await page.getByRole('button', { name: 'Add milestone' }).last().click();
  await expect(page.getByText('Design sign-off')).toBeVisible();
  await page.getByRole('link', { name: /^Updates/ }).click();
  await hydrated(page, 'Post update');
  await page.getByLabel('Post an update').fill('Design approved. Build starts on Monday.');
  await page.getByRole('button', { name: 'Post update' }).click();
  await expect(page.getByText('Design approved. Build starts on Monday.')).toBeVisible();
  await page.getByRole('link', { name: /^Files/ }).click();
  await hydrated(page, 'Upload');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'site-map.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
  });
  await page.getByLabel('Label').fill('Site map');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('link', { name: 'Site map' })).toBeVisible();

  // 16. The client follows the project, reads the update and downloads the deliverable.
  await client.goto('/portal/projects');
  await expect(client.getByRole('progressbar', { name: `${quoteTitle} progress` })).toBeVisible();
  await client.getByRole('link', { name: quoteTitle }).click();
  await expect(client.getByRole('list', { name: 'Milestones' })).toContainText('Design sign-off');
  await expect(client.getByTestId('project-updates')).toContainText('Design approved. Build starts on Monday.');
  const file = await client.request.get(
    (await client
      .getByRole('list', { name: 'Deliverables' })
      .getByRole('link', { name: 'Site map' })
      .getAttribute('href'))!,
  );
  expect(file.status()).toBe(200);
  expect((await file.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  await expectAccessible(client);
  await client.context().close();
});

/** The CSRF token the admin pages carry (`<meta name="csrf-token">`, sent by islands as x-csrf-token). */
async function csrf(page: Page): Promise<string> {
  return (await page.locator('meta[name="csrf-token"]').getAttribute('content')) ?? '';
}
