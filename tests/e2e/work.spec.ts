import { expect, test } from '@playwright/test';
import { expectAccessible, ownIp } from './helpers';

test.use(ownIp('work'));

test('our work shows the honest empty state when nothing is published', async ({ page }) => {
  expect((await page.goto('/work'))!.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Case studies are being prepared.' })).toBeVisible();
  await expect(page.getByText('Talk to us about what we can build for you.')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  await expectAccessible(page);
});

test('unpublished or unknown case studies and private media are 404', async ({ request }) => {
  expect((await request.get('/work/anything')).status()).toBe(404);
  expect((await request.get('/media/fil_doesnotexist')).status()).toBe(404);
});
