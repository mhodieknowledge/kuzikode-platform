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

test('draft invoice → issued and emailed → client views and downloads the PDF → part paid → paid → credit note (docs/08 flows 7–12)', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const n = Date.now() % 100000;
  const clientName = `Kopje Cafe ${n}`;
  await signIn(page, E2E_USERS.invoicesAdmin.email);

  await page.goto('/admin/clients/new');
  await hydrated(page, 'Create client');
  await page.getByLabel('Organisation name').fill(clientName);
  await page.getByLabel('Contact name').fill('Rudo Moyo');
  await page.getByLabel('Contact email').fill(`rudo-${n}@kopje.example`);
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page.getByRole('heading', { level: 1, name: clientName })).toBeVisible();

  // Draft with two lines: 450 + 2 × 75 = 600.
  await page.getByRole('link', { name: 'New invoice' }).click();
  await hydrated(page, 'Create draft');
  await expect(page.getByLabel('Line 1 billing')).toHaveCount(0); // invoices bill once
  await page.getByLabel('Line 1 description').fill('Menu website');
  await page.getByLabel('Line 1 unit price').fill('450');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Line 2 description').fill('Menu photo edits');
  await page.getByLabel('Line 2 quantity').fill('2');
  await page.getByLabel('Line 2 unit price').fill('75');
  await expect(page.locator('dl[aria-live="polite"]')).toContainText('$600.00');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create draft' }).click();

  await expect(page.getByText('Draft invoice').first()).toBeVisible();
  await hydrated(page, 'Issue invoice');
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Issue invoice' }).click();
  const numberText = page.getByText(/^INV-\d{4}-\d{5}$/).first();
  await expect(numberText).toBeVisible();
  const number = (await numberText.textContent())!.trim();
  await expectAccessible(page);
  await screenshots(page, 'admin-invoice-detail');

  // The email reaches the development mailbox with the /i/ link.
  await expect
    .poll(
      async () => {
        await page.goto('/admin/dev/mailbox');
        return page.getByRole('link', { name: `Invoice ${number} from` }).count();
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await page
    .getByRole('link', { name: `Invoice ${number} from` })
    .first()
    .click();
  const link = await page.getByRole('link', { name: 'View invoice' }).getAttribute('href');
  expect(link).toMatch(/\/i\/[A-Za-z0-9_-]+$/);

  // The client opens the link without a session and downloads the PDF.
  const clientContext = await browser.newContext({ baseURL: new URL(link!).origin });
  const client = await clientContext.newPage();
  await client.goto(new URL(link!).pathname);
  await expect(client.getByRole('heading', { level: 1, name: number })).toBeVisible();
  await expect(client.getByText('$600.00').first()).toBeVisible();
  await expectAccessible(client);
  await screenshots(client, 'public-invoice');
  const pdfHref = await client.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
  const pdf = await client.request.get(pdfHref!);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(pdf.headers()['content-disposition']).toContain(`${number}.pdf`);

  // Admin records a part payment, then the rest.
  await page.goto('/admin/invoices');
  await page.getByRole('link', { name: number }).click();
  await hydrated(page, 'Record payment');
  await page.getByRole('button', { name: 'Record payment' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount received (USD)').fill('200');
  await dialog.getByLabel('Reference').fill('FBC-7781');
  await dialog.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Partially paid ·')).toBeVisible();
  await expect(page.getByText('$400.00').first()).toBeVisible();

  await hydrated(page, 'Record payment');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await dialog.getByLabel('Amount received (USD)').fill('400');
  await dialog.getByLabel('Method').selectOption('cash');
  await dialog.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Paid ·')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^RCT-\d{4}-\d{5}$/ })).toHaveCount(2);

  // A goodwill credit note on the paid invoice goes to the client's account credit (P4.10).
  await hydrated(page, 'Credit note');
  await page.getByRole('button', { name: 'Credit note' }).click();
  await expect(dialog.getByLabel('Apply the credit')).toHaveValue('client_credit'); // nothing left to reduce
  await dialog.getByLabel('Other adjustment').fill('Goodwill discount');
  await dialog.getByLabel('Amount (USD)').fill('50');
  await dialog.getByLabel('Reason').fill('Launch delayed by us');
  await expect(dialog.getByText('Credit total: $50.00')).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Issue credit note' }).click();
  await expect(page.getByRole('link', { name: /^CN-\d{4}-\d{4}$/ })).toBeVisible();
  await expect(page.getByText(/Added to account credit · Launch delayed by us/)).toBeVisible();

  // Payments admin lists both receipts; a payment page shows where it was applied (P4.11).
  await page.goto(`/admin/payments?q=${encodeURIComponent(clientName)}`);
  await expect(page.getByRole('link', { name: /^RCT-\d{4}-\d{5}$/ })).toHaveCount(2);
  await expectAccessible(page);
  await screenshots(page, 'admin-payments');
  await page
    .getByRole('link', { name: /^RCT-\d{4}-\d{5}$/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 2, name: 'Applied to' })).toBeVisible();
  await expect(page.getByRole('link', { name: number })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download receipt' })).toBeVisible();
  await expectAccessible(page);

  // Expenses (P4.13): record one with a receipt, see it in the list and the report.
  await page.goto('/admin/expenses/new');
  await hydrated(page, 'Record expense');
  await page.getByLabel('Category').selectOption({ label: 'Hosting & cloud' });
  await page.getByLabel('Description').fill(`Hosting for ${clientName}`);
  await page.getByLabel('Amount (USD)').fill('35.50');
  await page.getByLabel('Vendor').fill('Example Cloud');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'receipt.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
  });
  await page.getByRole('button', { name: 'Record expense' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `$35.50 · Hosting for ${clientName}` })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View receipt' })).toBeVisible();
  await expectAccessible(page);
  await page.goto(`/admin/expenses?q=${encodeURIComponent(clientName)}`);
  await expect(page.getByRole('link', { name: `Hosting for ${clientName}` })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-expenses');
  await page.goto('/admin/expenses/report');
  await expect(page.getByRole('heading', { level: 2, name: 'By category' })).toBeVisible();
  await expectAccessible(page);

  await client.reload();
  await expect(client.getByText('Paid in full. Thank you.')).toBeVisible();
  await clientContext.close();
});
