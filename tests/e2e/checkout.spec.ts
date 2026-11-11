/**
 * P6.3d: Kuzikode's own checkout (docs/06 §3b) on the mock gateway. Fresh invoices per run (global-setup):
 *  a → public EcoCash success with receipt · b → public insufficient balance, cancel, InnBucks code + QR, bank notice
 *  c → portal O'mari OTP (double-click starts one attempt) · d → public card hand-off and back to our status page.
 * Mock test numbers: …1111111 paid after 5 s, …3333333 cancelled after 30 s, …4444444 refused at once.
 */
import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';
import { E2E_CHECKOUT_USER, E2E_PASSWORD, checkoutInvoiceId } from './users';

const DEV_HMAC_SECRET = 'dev-only-hmac-secret-not-for-production-use-0001';
const run = process.env.E2E_CHECKOUT_RUN ?? '';
const tokenFor = (id: string) => createHmac('sha256', DEV_HMAC_SECRET).update(`invoice:${id}`).digest('base64url');

test.use({ actionTimeout: 15_000 });
test.describe.configure({ timeout: 120_000 });

async function hydrated(page: Page) {
  await expect(page.locator('astro-island').filter({ hasText: 'Choose how to pay' })).not.toHaveAttribute('ssr');
}

async function publicCheckout(page: Page, slot: 'a' | 'b' | 'd') {
  const res = await page.goto(`/pay/${tokenFor(checkoutInvoiceId(run, slot))}`);
  expect(res?.status()).toBe(200);
  await hydrated(page);
  return res!;
}

test('public checkout: summary, test banner, EcoCash prompt → paid with receipt (no session)', async ({ page }) => {
  expect(run, 'global-setup sets E2E_CHECKOUT_RUN').not.toBe('');
  await page.setViewportSize({ width: 1440, height: 900 });
  // From the public invoice page: "Pay now" opens our checkout.
  const token = tokenFor(checkoutInvoiceId(run, 'a'));
  await page.goto(`/i/${token}`);
  await page.getByRole('link', { name: 'Pay now' }).click();
  await expect(page).toHaveURL(new RegExp(`/pay/${token}$`));
  const res = await page.reload();
  expect(res?.headers()['cache-control']).toBe('private, no-store');
  expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await hydrated(page);

  await expect(page.getByRole('heading', { level: 1, name: /^INV-E2E-C/ })).toBeVisible();
  await expect(page.getByText(E2E_CHECKOUT_USER.clientName)).toBeVisible();
  await expect(page.getByText('Menu board design')).toBeVisible();
  await expect(page.getByTestId('amount-due')).toHaveText('$25.00');
  await expect(page.getByText('TEST PAYMENT: no real money moves.')).toBeVisible();
  for (const name of ['EcoCash', 'OneMoney', 'InnBucks', "O'mari", 'Bank card', 'Bank transfer'])
    await expect(page.getByRole('radio', { name: new RegExp(`^${name}`) })).toBeAttached();
  // No gateway names or internals on our page.
  expect(await page.content()).not.toMatch(/paynow|pesepay|ppa_|mock:\/\//i);
  await expectAccessible(page);
  await screenshots(page, 'checkout-choose');
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByText('EcoCash', { exact: true }).click();
  // Pre-filled from the client profile.
  await expect(page.getByLabel('EcoCash number')).toHaveValue('0771111111');
  await page.getByRole('button', { name: 'Pay $25.00' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
  await expect(page.getByText('Check your phone: approve the EcoCash prompt and enter your PIN.')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'checkout-waiting');
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(page.getByRole('heading', { name: 'Payment received' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Payment received.' })).toBeAttached();
  const receipt = page.getByRole('link', { name: 'Download receipt (PDF)' });
  await expect(receipt).toHaveAttribute('href', /^\/api\/v1\/public\/payment-attempts\/[^/]+\/receipt\?t=/);
  const pdf = await page.request.get((await receipt.getAttribute('href'))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  await expectAccessible(page);
  await screenshots(page, 'checkout-paid');

  // The invoice is closed: the invoice page no longer offers "Pay now", and the checkout says there is nothing to pay.
  await page.goto(`/i/${token}`);
  await expect(page.getByText('Paid in full. Thank you.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pay now' })).toHaveCount(0);
  await page.goto(`/pay/${token}`);
  await expect(page.getByRole('heading', { name: 'Nothing to pay' })).toBeVisible();
});

test('public checkout: insufficient balance, cancelled on the phone, then InnBucks code + QR, bank transfer notice', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await publicCheckout(page, 'b');
  await page.getByText('EcoCash', { exact: true }).click();

  // Client-side check first, then the gateway refuses at once.
  await page.getByLabel('EcoCash number').fill('12345');
  await page.getByRole('button', { name: 'Pay $25.00' }).click();
  await expect(page.getByText('Enter a Zimbabwean mobile number, like 0771 234 567.')).toBeVisible();
  await page.getByLabel('EcoCash number').fill('0774444444');
  await page.getByRole('button', { name: 'Pay $25.00' }).click();
  await expect(page.getByRole('heading', { name: 'Payment not completed' })).toBeVisible();
  await expect(
    page.getByRole('paragraph').filter({ hasText: /declined\. Nothing was taken from your account/ }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: 'test-results/screens/checkout-failed-375.png', fullPage: true });

  // Try again keeps the method and number.
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('EcoCash number')).toHaveValue('0774444444');
  await page.getByLabel('EcoCash number').fill('0773333333');
  await page.getByRole('button', { name: 'Pay $25.00' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment not completed' })).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('paragraph').filter({ hasText: 'The payment was cancelled. Nothing was taken from your account.' }),
  ).toBeVisible();

  // Choose another method → InnBucks: code, QR drawn in our page, app link and expiry.
  await page.getByRole('button', { name: 'Choose another method' }).click();
  await page.getByText('InnBucks', { exact: true }).click();
  await page.getByRole('button', { name: 'Pay $25.00' }).click();
  const code = page.getByTestId('wallet-code');
  await expect(code).toHaveText(/^\d{9}$/);
  const value = (await code.textContent())!;
  await expect(page.getByRole('img', { name: `QR code for InnBucks payment code ${value}` })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open InnBucks app' })).toHaveAttribute(
    'href',
    `com.innbucks.customer://purchase?paymentToken=${value}`,
  );
  await expect(page.getByText(/^Valid until \d{2}:\d{2} \(Harare time\)$/)).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: 'test-results/screens/checkout-innbucks-375.png', fullPage: true });

  // Bank transfer: details from Settings and "I've paid" (a note for finance, nothing marked paid).
  await page.getByRole('button', { name: 'Choose another method' }).click();
  await page.getByText('Bank transfer', { exact: true }).click();
  await expect(page.getByText('Account 0000000000')).toBeVisible();
  await page.getByLabel('Paid by (name on the account)').fill('Chipo Checkout');
  await page.getByRole('button', { name: "I've paid, notify Kuzikode" }).click();
  await expect(page.getByText('Thank you. We have told our finance team.')).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: 'test-results/screens/checkout-bank-375.png', fullPage: true });
  await page.goto(`/i/${tokenFor(checkoutInvoiceId(run, 'b'))}`);
  await expect(page.getByRole('link', { name: 'Pay now' })).toBeVisible();
});

test('portal checkout: O’mari OTP, a double click starts one attempt, paid → receipt', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portal/login');
  await expect(page.locator('astro-island').filter({ hasText: 'Sign in' }).first()).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(E2E_CHECKOUT_USER.email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/portal$/);

  const id = checkoutInvoiceId(run, 'c');
  await page.goto(`/portal/invoices/${id}`);
  await page.getByRole('link', { name: 'Pay now' }).click();
  await expect(page).toHaveURL(new RegExp(`/portal/invoices/${id}/pay$`));
  await hydrated(page);
  await expect(page.getByTestId('amount-due')).toHaveText('$25.00');

  const starts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith(`/api/v1/portal/invoices/${id}/pay`)) starts.push(r.url());
  });
  await page.getByText("O'mari", { exact: true }).click();
  await expect(page.getByLabel("O'mari number")).toHaveValue('0771111111');
  await page.getByRole('button', { name: 'Pay $25.00' }).dblclick();
  await expect(page.getByRole('group', { name: 'One-time code from the SMS' })).toBeVisible();
  expect(starts).toHaveLength(1);
  await expectAccessible(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.screenshot({ path: 'test-results/screens/checkout-otp-375.png', fullPage: true });

  // Paste fills all six boxes and submits.
  await page.getByLabel('Digit 1 of 6').focus();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '123456');
    document.activeElement?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  await expect(page.getByRole('heading', { name: 'Payment received' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Download receipt (PDF)' })).toHaveAttribute(
    'href',
    /^\/api\/v1\/portal\/payments\/[^/]+\/receipt$/,
  );
  await page.getByRole('link', { name: /^Back to invoice/ }).click();
  await expect(page).toHaveURL(new RegExp(`/portal/invoices/${id}$`));
  await expect(page.getByRole('link', { name: 'Pay now' })).toHaveCount(0);
});

test('public checkout: card hands off to the secure page, which returns to our status page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await publicCheckout(page, 'd');
  await page.getByText('Bank card', { exact: true }).click();
  await expect(page.getByText("card details are entered on our payment partner's secure page")).toBeVisible();
  await page.getByRole('button', { name: 'Pay $25.00' }).click();
  await expect(page).toHaveURL(/\/dev\/mock-checkout\//);
  await page.getByRole('button', { name: /^Succeed/ }).click();
  await expect(page).toHaveURL(/\/pay\/return\?attempt=/);
  await expect(page.getByRole('heading', { name: 'Payment received' })).toBeVisible({ timeout: 30_000 });
});
