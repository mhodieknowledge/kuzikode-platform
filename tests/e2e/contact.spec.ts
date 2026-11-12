import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('contact'));

test('visitor sends an enquiry and sees a reference; quotation links preselect the service', async ({ page }) => {
  await page.goto('/contact?category=web-development&service=e-commerce');
  await expect(page.getByRole('heading', { level: 1, name: 'Contact us' })).toBeVisible();
  await expect(page.getByLabel('What is this about?')).toHaveValue('web-development');
  await expect(page.getByLabel('Service (optional)', { exact: true })).toHaveValue('e-commerce');
  await expectAccessible(page);
  await screenshots(page, 'contact');

  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Please check the highlighted fields.');
  await expect(page.getByText('Enter your name.')).toBeVisible();

  await page.getByLabel('Your name').fill('Rudo Example');
  await page.getByLabel('Email').fill('rudo@example.com');
  await page.getByLabel('Message').fill('We need an online store with EcoCash payments for about 80 products.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send message' }).click();
  const done = page.getByRole('status').filter({ hasText: 'Thank you. We have your message.' });
  await expect(done).toBeVisible();
  await expect(done).toContainText(/ENQ-\d{4}-\d{4}/);
});

test('the retired wizard URL 301s to the contact form, keeping the package preselection (BRIEF B.0c)', async ({
  page,
  request,
}) => {
  const res = await request.get('/start-a-project?package=business-website&x=<script>', { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()['location']).toBe('/contact?package=business-website');
  const bare = await request.get('/start-a-project', { maxRedirects: 0 });
  expect(bare.headers()['location']).toBe('/contact');

  // "Request this package" on the pricing page → contact form with the package's division and service preselected.
  await page.goto('/pricing');
  const link = page.locator('li[data-package="business-website"]').getByRole('link', { name: /Request this package/ });
  await link.click();
  await expect(page).toHaveURL(/\/contact\?category=[a-z0-9-]+&package=business-website$/);
  await expect(page.locator('[data-package="business-website"]')).toContainText('Package: Business Website');
  await expect(page.getByLabel('What is this about?')).not.toHaveValue('');
  await expect(page.getByLabel('Message')).toHaveValue(/request the Business Website package/);
  // The request is previewed before it is sent.
  await expect(page.locator('.kz-eform__summary')).toContainText('Business Website package');
  expect(await page.locator('a[href^="/start-a-project"]').count()).toBe(0);
});
