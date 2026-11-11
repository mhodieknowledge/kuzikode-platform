import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('pricing'));

test('pricing page: tabs, packages, comparison table, add-ons, VAT note and FAQ', async ({ page }) => {
  expect((await page.goto('/pricing'))!.status()).toBe(200);
  await expect(page.locator('h1')).toHaveCount(1);
  const nav = page.getByRole('navigation', { name: 'Pricing categories' });
  for (const label of ['Websites', 'Care plans', 'Email & domains', 'Other services']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  const websites = page.locator('#websites');
  await expect(websites.locator('[data-package]')).toHaveCount(4);
  const popular = websites.locator('[data-package="business-website"]');
  await expect(popular.getByText('Most popular')).toBeVisible();
  // Non-production shows prices (pricing.show_prices = true in nonprod seed).
  await expect(websites.locator('[data-package="starter-website"] [data-price]')).toContainText('$350');
  await expect(websites.locator('[data-package="custom-web-app"] [data-price]')).toContainText('Custom quote');
  await expect(page.locator('[data-package="business-email"]')).toContainText('Minimum 3 mailboxes');

  const getStarted = popular.getByRole('link', { name: /Get started/ });
  await expect(getStarted).toHaveAttribute('href', '/start-a-project?package=business-website');

  await page.setViewportSize({ width: 1440, height: 900 });
  const table = websites.getByRole('table', { name: 'Websites: package comparison' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('rowheader', { name: /Online payments/ })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(table).toBeHidden();
  await expect(
    websites.locator('[data-package="starter-website"]').getByText('Mobile-responsive design'),
  ).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Add-ons' })).toBeVisible();
  await expect(page.locator('[data-vat-note]')).toContainText('Prices exclude VAT where applicable');
  await expect(page.getByRole('heading', { name: 'Pricing questions' })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('"FAQPage"'))).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectAccessible(page);
  await screenshots(page, 'pricing');
});

test('division page shows its packages with a link to pricing', async ({ page }) => {
  await page.goto('/services/cloud-it');
  await expect(page.getByRole('heading', { name: 'Packages', exact: true })).toBeVisible();
  await expect(page.locator('[data-package="business-email"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Compare all pricing' })).toHaveAttribute('href', '/pricing');
  await expectAccessible(page);
});
