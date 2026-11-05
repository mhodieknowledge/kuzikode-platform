import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

test('WhatsApp button is hidden when no number is configured', async ({ page }) => {
  for (const path of ['/', '/pricing', '/contact']) {
    await page.goto(path);
    await expect(page.locator('[data-whatsapp]')).toHaveCount(0);
  }
});

test('consultation: request form with preferred times creates a consultation enquiry', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('link', { name: 'Book a free consultation' }).click();
  await expect(page).toHaveURL(/\/consultation$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book a free 30-minute consultation');
  await expect(page.locator('[data-booking-link]')).toHaveCount(0); // booking.cal_url is empty by default
  await expectAccessible(page);
  await screenshots(page, 'consultation');

  await page.getByLabel('Your name').fill('Tariro Example');
  await page.getByLabel('Email').fill('tariro@example.com');
  await page.getByLabel('What would you like to discuss?').fill('A booking system for our guest lodge.');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Request a consultation' }).click();
  await expect(page.getByText('Suggest at least one time that suits you.')).toBeVisible();
  await page.getByLabel('Option 1').fill('2026-11-10T10:00');
  await page.getByLabel('Option 2').fill('2026-11-11T14:30');
  await page.getByRole('button', { name: 'Request a consultation' }).click();
  const done = page.getByRole('status').filter({ hasText: 'We will confirm a time.' });
  await expect(done).toContainText(/ENQ-\d{4}-\d{4}/);
});

test('footer newsletter sign-up asks the visitor to confirm by email', async ({ page }) => {
  await page.goto('/about');
  const footer = page.getByRole('contentinfo');
  // Wait for the island to hydrate (Astro removes the `ssr` attribute).
  await expect(page.locator('astro-island:has(#newsletter-email)')).not.toHaveAttribute('ssr');
  await footer.getByLabel(/Occasional updates/).fill(`reader-${Date.now()}@example.com`);
  await footer.getByRole('button', { name: 'Subscribe' }).click();
  await expect(footer.getByRole('status')).toHaveText('Check your inbox and confirm your subscription.');
});

test('confirm and unsubscribe pages require a POST and reject bad links', async ({ page, request }) => {
  await page.goto('/newsletter/confirm?token=not-a-real-token');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.getByRole('button', { name: 'Confirm subscription' }).click();
  await expect(page.getByRole('alert')).toContainText('not valid');

  await page.goto('/newsletter/unsubscribe?id=nws_abc&sig=forged');
  await expect(page.getByRole('alert')).toContainText('This unsubscribe link is not valid');
  await expect(page.getByRole('button', { name: 'Unsubscribe' })).toHaveCount(0);

  // Cross-site form posts are refused.
  const res = await request.post('/newsletter/confirm', {
    form: { token: 'x' },
    headers: { origin: 'https://evil.example' },
  });
  expect(res.status()).toBe(403);
});
