/** P6.6: the development email preview lists every template and renders each one (HTML and plain text). */
import { expect, test } from '@playwright/test';
import { TEMPLATE_NAMES } from '../../src/server/email/templates';
import { ownIp } from './helpers';

test.use(ownIp('email-preview'));

test('dev email preview: every template listed; HTML and text render', async ({ page, request }) => {
  const res = await page.goto('/dev/emails');
  expect(res?.status()).toBe(200);
  for (const name of TEMPLATE_NAMES) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

  await page
    .getByRole('row', { name: /quotation_accepted \(recorded by staff\)/ })
    .getByRole('link', { name: 'HTML' })
    .click();
  await expect(page.getByRole('heading', { name: 'A quotation was accepted' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  const text = await request.get('/dev/emails/invoice_reminder?variant=due%20today&format=text');
  expect(text.status()).toBe(200);
  expect(await text.text()).toContain('Subject: Reminder: invoice INV-2026-00001 is due today');
  expect((await request.get('/dev/emails/not_a_template')).status()).toBe(404);
});
