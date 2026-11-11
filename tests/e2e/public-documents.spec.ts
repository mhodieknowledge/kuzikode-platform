/**
 * P5.8: the gateway return page `/pay/return` without a session, and the private headers on every public token page.
 * The signature is computed like `paymentReturnUrl` with the local development HMAC secret (no `.dev.vars` in tests).
 */
import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

const DEV_HMAC_SECRET = 'dev-only-hmac-secret-not-for-production-use-0001';
const sign = (attemptId: string) =>
  createHmac('sha256', DEV_HMAC_SECRET).update(`payment_return:${attemptId}`).digest('base64url');

test('a client returning from the gateway sees the attempt status, without a session (P5.8)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = 'pat_e2e_portal_failed';
  const res = await page.goto(`/pay/return?attempt=${id}&t=${sign(id)}`);
  expect(res?.status()).toBe(200);
  expect(res?.headers()['cache-control']).toBe('private, no-store');
  expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { name: 'Payment not completed' })).toBeVisible();
  await expect(page.getByText('Nothing was taken from your account.')).toBeVisible();
  await expect(page.getByText('EcoCash · 077****111')).toBeVisible();
  // No navigation into the portal from a public page (docs/07 §6).
  await expect(page.locator('a[href^="/portal"]')).toHaveCount(0);
  await expectAccessible(page);
  await screenshots(page, 'pay-return');

  // The invoice link opens the public invoice page, also private.
  await page.setViewportSize({ width: 1440, height: 900 });
  const back = page.getByRole('link', { name: 'Back to invoice INV-E2E-P002' });
  await expect(back).toHaveAttribute('href', /^\/i\/[A-Za-z0-9_-]{43}$/);
  const inv = await page.request.get((await back.getAttribute('href'))!);
  expect(inv.status()).toBe(200);
  expect(inv.headers()['cache-control']).toBe('private, no-store');
  expect(inv.headers()['x-robots-tag']).toBe('noindex, nofollow');
});

test('bad tokens and signatures are 404 and still private (P5.8)', async ({ request }) => {
  const other = sign('pat_e2e_someone_else');
  for (const path of [
    '/pay/return',
    `/pay/return?attempt=pat_e2e_portal_failed&t=${other}`,
    '/q/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    '/i/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    '/i/not-a-token',
  ]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
    expect(res.headers()['cache-control'], path).toBe('private, no-store');
    expect(res.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
  }
});

test('mock gateway page: test banner, pick an outcome, back to our site (P6.1)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto('/dev/mock-checkout/mock_pat_e2e_checkout');
  expect(res?.status()).toBe(200);
  expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.getByText('TEST PAYMENT, no real money.')).toBeVisible();
  await expect(page.getByText('$45.00')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'mock-checkout');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /^Succeed/ }).click();
  await expect(page).toHaveURL(/\/contact$/);
  // Settled: the page now only offers the way back.
  await page.goto('/dev/mock-checkout/mock_pat_e2e_checkout');
  await expect(page.getByText('succeeded', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Succeed/ })).toHaveCount(0);
  expect((await page.request.get('/dev/mock-checkout/mock_unknown')).status()).toBe(404);
});
