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

test('quotation with 3 lines, discount and tax → sent by email → accepted on the public link → converted (docs/08 flows 4–6)', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const n = Date.now() % 100000;
  const clientName = `Msasa Bakery ${n}`;
  const contactEmail = `orders-${n}@msasa.example`;
  await signIn(page, E2E_USERS.quotesAdmin.email);

  // A client with a main contact.
  await page.goto('/admin/clients/new');
  await hydrated(page, 'Create client');
  await page.getByLabel('Organisation name').fill(clientName);
  await page.getByLabel('Contact name').fill('Chipo Ncube');
  await page.getByLabel('Contact email').fill(contactEmail);
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page.getByRole('heading', { level: 1, name: clientName })).toBeVisible();

  await page.getByRole('link', { name: 'New quotation' }).click();
  await hydrated(page, 'Create draft');
  await page.getByLabel('Title').fill('Online ordering website');
  await page.getByLabel('Line 1 description').fill('Website design and build');
  await page.getByLabel('Line 1 unit price').fill('900');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Line 2 description').fill('Product photography edits');
  await page.getByLabel('Line 2 quantity').fill('20');
  await page.getByLabel('Line 2 unit price').fill('5');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Line 3 description').fill('Hosting, first year');
  await page.getByLabel('Line 3 unit price').fill('120');
  await page.getByLabel('Line 3 tax').selectOption('tax_vat');
  await page.getByLabel('Overall discount', { exact: true }).selectOption('percent');
  await page.getByLabel('Overall discount percent').fill('5');
  // 900 + 100 + 120 = 1,120; −5% = 1,064 (line 3: 114 + 15.5% VAT 17.67) → 1,081.67
  await expect(page.locator('dl[aria-live="polite"]')).toContainText('$1,081.67');
  await expectAccessible(page);
  await screenshots(page, 'admin-quotation-editor');
  await page.getByRole('button', { name: 'Create draft' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Online ordering website' })).toBeVisible();
  await expect(page.getByText('Draft (not yet numbered)')).toBeVisible();
  await hydrated(page, 'Send to client');
  await page.getByRole('button', { name: 'Send to client' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send quotation' }).click();
  const numberText = page.getByText(/^QUO-\d{4}-\d{4}$/).first();
  await expect(numberText).toBeVisible();
  const number = (await numberText.textContent())!.trim();
  await expectAccessible(page);
  await screenshots(page, 'admin-quotation-detail');
  const adminPdf = await page.request.get(
    (await page.getByRole('link', { name: 'Download PDF' }).getAttribute('href'))!,
  );
  expect(adminPdf.status()).toBe(200);
  expect(adminPdf.headers()['content-disposition']).toContain(`${number}.pdf`);

  // The email is captured by the development mailbox.
  await expect
    .poll(
      async () => {
        await page.goto('/admin/dev/mailbox');
        return page.getByRole('link', { name: `Quotation ${number}: Online ordering website` }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page
    .getByRole('link', { name: `Quotation ${number}: Online ordering website` })
    .first()
    .click();
  const link = await page.getByRole('link', { name: 'View quotation' }).getAttribute('href');
  expect(link).toMatch(/\/q\/[A-Za-z0-9_-]+$/);

  // The client opens the link (no session) and accepts.
  const clientContext = await browser.newContext({ baseURL: new URL(link!).origin });
  const client = await clientContext.newPage();
  await client.goto(new URL(link!).pathname);
  await expect(client.getByRole('heading', { level: 1, name: 'Online ordering website' })).toBeVisible();
  await expect(client.getByText('$1,081.67').first()).toBeVisible();
  await expectAccessible(client);
  await screenshots(client, 'public-quotation');
  // docs/08 flow 5: the client downloads the PDF (stored once, TEST-watermarked outside production).
  const pdfHref = await client.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
  const pdf = await client.request.get(pdfHref!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  await hydrated(client, 'Accept quotation');
  await client.getByRole('button', { name: 'Accept quotation' }).click();
  await expect(client.getByText('Type your full name.')).toBeVisible();
  await client.getByLabel('Your full name').fill('Chipo Ncube');
  await client.getByRole('checkbox').check();
  await client.getByRole('button', { name: 'Accept quotation' }).click();
  await expect(client.getByRole('status').filter({ hasText: 'You have accepted this quotation.' })).toBeVisible();
  await client.reload();
  await expect(client.getByText(/Accepted by Chipo Ncube/)).toBeVisible();
  await clientContext.close();

  // Back in admin: convert to a draft invoice.
  await page.goto(`/admin/quotations?status=all&q=${number}`);
  await page.getByRole('link', { name: 'Online ordering website' }).first().click();
  await expect(page.getByText(/^Accepted/).first()).toBeVisible();
  await expect(page.getByText(/· Chipo Ncube$/)).toBeVisible();
  await hydrated(page, 'Convert to invoice');
  await page.getByRole('button', { name: 'Convert to invoice' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Converted to a draft invoice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Convert to invoice' })).toHaveCount(0);

  // docs/08 step 15: a project from the quotation, with a client-visible milestone, an update and a deliverable.
  await hydrated(page, 'Create project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Online ordering website' })).toBeVisible();
  await expect(page.getByText(/^PRJ-\d{4}-\d{4}$/).first()).toBeVisible();
  await hydrated(page, 'Add milestone');
  await page.getByRole('button', { name: 'Add milestone' }).click();
  await page.getByLabel('Milestone title').fill('Design sign-off');
  await page.getByRole('button', { name: 'Add milestone' }).last().click();
  await expect(page.getByText('Design sign-off')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-project-overview');

  await page.getByRole('link', { name: /^Updates/ }).click();
  await hydrated(page, 'Post update');
  await page.getByLabel('Post an update').fill('Design approved. Build starts on Monday.');
  await page.getByRole('button', { name: 'Post update' }).click();
  await expect(page.getByText('Design approved. Build starts on Monday.')).toBeVisible();
  await expect(page.getByText(/shared with the client/)).toBeVisible();

  await page.getByRole('link', { name: /^Files/ }).click();
  await hydrated(page, 'Upload');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'style-guide.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
  });
  await page.getByLabel('Label').fill('Style guide');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('link', { name: 'Style guide' })).toBeVisible();
  await expect(page.getByText(/deliverable · visible to the client/)).toBeVisible();
  await expectAccessible(page);
});
