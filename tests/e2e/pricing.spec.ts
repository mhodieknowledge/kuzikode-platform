import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('pricing'));

test('pricing page: categories, packages, comparison table, add-ons, VAT note and FAQ', async ({ page }) => {
  expect((await page.goto('/pricing'))!.status()).toBe(200);
  await expect(page.locator('h1')).toHaveCount(1);
  const nav = page.getByRole('navigation', { name: 'Pricing categories' });
  for (const label of ['Websites', 'Other services']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  // Care plans, email and domains are no longer sold (REFINEMENTS §1).
  for (const label of ['Care plans', 'Email & domains'])
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  const websites = page.locator('#websites');
  // Plates are list items; the desktop comparison table repeats the packages as column headers (R4.3).
  await expect(websites.locator('li[data-package]')).toHaveCount(4);
  const popular = websites.locator('li[data-package="business-website"]');
  await expect(popular.getByText('Recommended')).toBeVisible();
  // Non-production shows prices (pricing.show_prices = true in nonprod seed).
  await expect(websites.locator('li[data-package="starter-website"] [data-price]')).toContainText('$150');
  await expect(websites.locator('li[data-package="business-website"] [data-price]')).toContainText('$320');
  await expect(websites.locator('li[data-package="ecommerce-website"] [data-price]')).toContainText(/From\s*\$650/);
  await expect(websites.locator('li[data-package="custom-web-application"] [data-price]')).toContainText(
    /From\s*\$1,200/,
  );
  // Add-ons are a priced division in the "Other services" ledger, with their units.
  await expect(page.locator('#other li[data-package="additional-pages"]')).toContainText('per page');
  await expect(page.locator('#other li[data-package="payment-local-method"]')).toContainText('per local method');
  await expect(page.locator('#other li[data-package="payment-card"] [data-price]')).toContainText('$100');

  const request = popular.getByRole('link', { name: /Request this package/ });
  await expect(request).toHaveAttribute('href', /^\/contact\?category=[a-z0-9-]+&package=business-website$/);

  await page.setViewportSize({ width: 1440, height: 900 });
  const table = websites.getByRole('table', { name: 'Websites: package comparison' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('rowheader', { name: /EcoCash, OneMoney, InnBucks and card payments/ })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(table).toBeHidden();
  await expect(websites.locator('li[data-package="starter-website"]').getByText('Mobile-first design')).toBeVisible();

  await expect(page.locator('#other').getByText('Add-ons', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-vat-note]')).toContainText('Prices exclude VAT where applicable');
  await expect(page.getByRole('heading', { name: 'Pricing questions' })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('"FAQPage"'))).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectAccessible(page);
  await screenshots(page, 'pricing');
});

test('division page shows its packages with a link to pricing', async ({ page }) => {
  await page.goto('/services/automation-integration');
  await expect(page.getByRole('heading', { name: 'Packages and prices', exact: true })).toBeVisible();
  await expect(page.locator('[data-package="payment-local-method"]').first()).toBeVisible();
  // Each division page shows only its own packages.
  await expect(page.locator('[data-package="starter-website"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Compare all pricing' })).toHaveAttribute('href', '/pricing');
  await expectAccessible(page);
});
