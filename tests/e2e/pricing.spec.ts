import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('pricing'));

test('pricing page: one block per division with carousel and comparison table, VAT note, one FAQ and one CTA', async ({
  page,
}) => {
  expect((await page.goto('/pricing'))!.status()).toBe(200);
  await expect(page.locator('h1')).toHaveCount(1);
  // No tabs, segmented controls or category switchers (REFINEMENTS §2).
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Pricing categories' })).toHaveCount(0);
  await expect(page.locator('[data-kz-seg], [data-kz-compare]')).toHaveCount(0);
  // One block per division; retired divisions and packages are gone.
  for (const slug of [
    'websites',
    'business-software',
    'cross-platform-apps',
    'ai-data',
    'automation-integration',
    'add-ons',
  ])
    await expect(page.locator(`section#${slug}`)).toHaveCount(1);
  await expect(page.locator('#care, #email, #other')).toHaveCount(0);
  const websites = page.locator('#websites');
  // Cards are list items; the comparison table repeats the packages as column headers.
  await expect(websites.locator('li[data-package]')).toHaveCount(4);
  const popular = websites.locator('li[data-package="business-website"]');
  await expect(popular.getByText('Most popular')).toBeVisible();
  // Non-production shows prices (pricing.show_prices = true in nonprod seed).
  await expect(websites.locator('li[data-package="starter-website"] [data-price]')).toContainText('$150');
  await expect(websites.locator('li[data-package="business-website"] [data-price]')).toContainText('$320');
  await expect(websites.locator('li[data-package="ecommerce-website"] [data-price]')).toContainText(/From\s*\$650/);
  await expect(websites.locator('li[data-package="custom-web-application"] [data-price]')).toContainText(
    /From\s*\$1,200/,
  );
  // Add-ons are a division with their units.
  await expect(page.locator('#add-ons li[data-package="additional-pages"]')).toContainText('per page');
  await expect(page.locator('#automation-integration li[data-package="payment-local-method"]')).toContainText(
    'per local method',
  );
  await expect(page.locator('#automation-integration li[data-package="payment-card"] [data-price]')).toContainText(
    '$100',
  );
  // A single priced offer is one compact card, without a carousel or table.
  await expect(page.locator('#cross-platform-apps li[data-package]')).toHaveCount(1);
  await expect(page.locator('#cross-platform-apps [data-kz-rail], #cross-platform-apps table')).toHaveCount(0);

  const request = popular.getByRole('link', { name: /Get a quote/ });
  await expect(request).toHaveAttribute('href', /^\/contact\?category=[a-z0-9-]+&package=business-website$/);

  // The comparison table has every website package as a column at every size (it scrolls sideways on phones).
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const table = websites.getByRole('table', { name: /package comparison/ });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveCount(5);
    await expect(table.getByRole('rowheader', { name: /EcoCash, OneMoney, InnBucks and card payments/ })).toHaveCount(
      1,
    );
  }
  await expect(websites.locator('li[data-package="starter-website"]').getByText('Mobile-first design')).toBeVisible();

  // One FAQ, the VAT note and one closing "Get a quote" band.
  await expect(page.locator('[data-vat-note]')).toContainText('Prices exclude VAT where applicable');
  await expect(page.getByRole('heading', { name: 'Pricing questions' })).toHaveCount(1);
  await expect(page.locator('.kz-qband')).toHaveCount(1);
  await expect(page.locator('.kz-qband').getByRole('link', { name: 'Get a quote' })).toHaveAttribute(
    'href',
    '/contact',
  );
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
