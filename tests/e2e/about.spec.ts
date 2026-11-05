import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

test('about page renders all CMS blocks and no team section without real members', async ({ page }) => {
  expect((await page.goto('/about'))!.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'About Kuzikode' })).toBeVisible();
  for (const h of [
    'Our story',
    'Mission',
    'Vision',
    'Core values',
    'Objectives',
    'Our approach to technology and problem-solving',
  ]) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
  }
  await expect(
    page.getByText('To empower businesses and organisations through accessible, intelligent and dependable technology'),
  ).toBeVisible();
  for (const v of ['Excellence', 'Innovation', 'Integrity', 'Customer commitment', 'Continuous growth']) {
    await expect(page.getByRole('term').filter({ hasText: v })).toBeVisible();
  }
  await expect(page.locator('#team')).toHaveCount(0);
  await expectAccessible(page);
  await screenshots(page, 'about');
});
