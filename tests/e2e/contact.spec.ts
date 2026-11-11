import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('contact'));

test('visitor sends an enquiry and sees a reference; quotation links preselect the service', async ({ page }) => {
  await page.goto('/contact?category=web-development&service=e-commerce');
  await expect(page.getByRole('heading', { level: 1, name: 'Contact us' })).toBeVisible();
  await expect(page.getByLabel('What is this about?')).toHaveValue('web-development');
  await expect(page.getByLabel('Service')).toHaveValue('e-commerce');
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
