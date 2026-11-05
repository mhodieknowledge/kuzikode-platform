import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers';

test('products page shows Business Suite as In Development with no purchase wording', async ({ page, request }) => {
  expect((await page.goto('/products'))!.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 2, name: 'Kuzikode Business Suite' })).toBeVisible();
  await expect(page.getByText('In Development', { exact: true })).toBeVisible();
  const html = (await (await request.get('/products')).text()).toLowerCase();
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  expect(main).not.toMatch(
    /\b(buy|purchase|subscribe|subscription|sign up|signup|waitlist|wait list|pre-order|preorder|pricing|price|\$\d)/,
  );
  await expectAccessible(page);
});

test('register interest creates a product-interest enquiry', async ({ page }) => {
  await page.goto('/products');
  await page.getByLabel('Your name').fill('Tendai Example');
  await page.getByLabel('Email').fill('tendai.interest@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Register interest' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'noted your interest' })).toContainText(/ENQ-\d{4}-\d{4}/);
});
