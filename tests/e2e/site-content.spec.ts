import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('site-content'));

test('FAQ page: 20+ questions in categories, FAQPage JSON-LD, live filter, deep links open the answer', async ({
  page,
}) => {
  await page.goto('/faq');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Frequently asked questions');
  const items = page.locator('[data-faq-item]');
  expect(await items.count()).toBeGreaterThanOrEqual(20);
  for (const label of ['General', 'Projects', 'Pricing & payments', 'Support', 'Careers']) {
    await expect(page.getByRole('heading', { level: 2, name: label })).toBeVisible();
  }
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(
    (t) => JSON.parse(t) as Record<string, unknown>[],
  );
  const faqPage = ld.find((x) => x['@type'] === 'FAQPage') as { mainEntity: unknown[] } | undefined;
  expect(faqPage?.mainEntity.length).toBe(await items.count());
  await expectAccessible(page);
  await screenshots(page, 'faq');

  await page.getByLabel('Filter questions').fill('ecocash');
  await expect(page.getByRole('status')).toHaveText(/^\d+ matching question/);
  await expect(page.locator('[data-faq-item]:visible')).toHaveCount(1);
  await expect(page.getByText('How can I pay?')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Careers' })).toBeHidden();

  await page.goto('/faq#faq_support_backups');
  await expect(page.locator('#faq_support_backups')).toHaveAttribute('open', '');
});

test('How we work page renders process, engagement models, expectations, practices and technologies', async ({
  page,
}) => {
  await page.goto('/how-we-work');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How we work');
  for (const h of ['Our process', 'Ways to work with us', 'What you can expect', 'Quality and security practices']) {
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Tools we build with' })).toBeVisible();
  // The process is one road with every stop shown in full, and the hero shows the same stops on the scope sheet.
  await expect(page.locator('.kz-proad__stop')).toHaveCount(5);
  await expect(page.locator('.kz-scope__ms li')).toHaveCount(5);
  await expect(page.getByText(/clients include|trusted by|partners/i)).toHaveCount(0);
  await expectAccessible(page);
  await screenshots(page, 'how-we-work');
});

test('home hides the testimonials block when none are published and shows technologies', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testimonials]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: "In our clients' words" })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tools we build with' })).toBeVisible();
});

test('site search from the header finds services, packages and articles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.locator('#site-search').fill('ecocash');
  await page.locator('main').getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search\?q=ecocash$/);
  const results = page.getByRole('region', { name: 'Search results' }).getByRole('listitem');
  expect(await results.count()).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: 'Accepting EcoCash and card payments on your website' })).toBeVisible();
  await expectAccessible(page);
  await page.goto('/search?q=zzzqqq');
  await expect(page.getByRole('status')).toContainText('No results');

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#mobile-search').fill('pricing');
  await page.locator('#mobile-search').press('Enter');
  await expect(page).toHaveURL(/\/search\?q=pricing$/);
});
