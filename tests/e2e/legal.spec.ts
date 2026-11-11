import { expect, test } from '@playwright/test';
import { expectAccessible, ownIp } from './helpers';

test.use(ownIp('legal'));

const PAGES = [
  ['Privacy Policy', '/legal/privacy', 'Cyber and Data Protection Act'],
  ['Terms of Use', '/legal/terms', 'governed by the laws of Zimbabwe'],
  ['Service Terms', '/legal/service-terms', 'When you have paid in full'],
  ['Cookie notice', '/legal/cookies', 'strictly necessary'],
  ['Accessibility', '/legal/accessibility', 'WCAG'],
] as const;

test('legal pages are linked from the footer and render their text', async ({ page }) => {
  for (const [label, href, text] of PAGES) {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(href);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('main')).toContainText(text);
  }
  await expectAccessible(page);
});

test('legal pages never claim the company is registered', async ({ request }) => {
  for (const [, href] of PAGES) {
    const html = await (await request.get(href)).text();
    expect(html).not.toMatch(/registered (company|in Zimbabwe)|\(Private\) Limited|Pvt\) Ltd/i);
  }
  expect((await request.get('/legal/unknown')).status()).toBe(404);
});
