import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

const SLUGS = [
  'web-development',
  'mobile-desktop-apps',
  'business-software',
  'ai-data',
  'automation-integration',
  'cloud-it',
];

test('services index lists all six divisions with links that resolve', async ({ page, request }) => {
  expect((await page.goto('/services'))!.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Service divisions' }).getByRole('heading', { level: 2 })).toHaveCount(
    6,
  );
  for (const slug of SLUGS) expect((await request.get(`/services/${slug}`)).status()).toBe(200);
  await expectAccessible(page);
});

test('every division page renders sub-services, deliverables, FAQ and a preselected quotation CTA', async ({
  page,
}) => {
  for (const slug of SLUGS) {
    await page.goto(`/services/${slug}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'What we offer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Typical deliverables' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Questions' })).toBeVisible();
    const cta = page.getByRole('link', { name: 'Request a quotation', exact: true }).first();
    await expect(cta).toHaveAttribute('href', `/contact?category=${slug}`);
  }
  await page.goto('/services/web-development');
  await expect(page.getByRole('link', { name: 'Request a quotation for E-commerce platforms' })).toHaveAttribute(
    'href',
    '/contact?category=web-development&service=e-commerce',
  );
  await expectAccessible(page);
  await screenshots(page, 'service-web');
});

test('unknown divisions return 404', async ({ request }) => {
  expect((await request.get('/services/not-a-division')).status()).toBe(404);
});
