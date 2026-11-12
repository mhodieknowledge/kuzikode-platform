import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('industries'));

test('industries index links to 8 pages whose service and package links all resolve', async ({ page, request }) => {
  expect((await page.goto('/industries'))!.status()).toBe(200);
  const cards = page.getByRole('region', { name: 'Industries we serve' }).getByRole('link');
  await expect(cards).toHaveCount(8);
  await expectAccessible(page);
  await screenshots(page, 'industries');
  const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.locator('h1')).toContainText('Solutions for');
    await expect(page.getByRole('heading', { name: 'Challenges we solve' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Relevant services' })).toBeVisible();
    const links = await page
      .locator('main a[href^="/services/"], main a[href="/contact"], main a[href="/pricing"]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')!))]);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect((await request.get(l)).status(), l).toBe(200);
    await expect(page.getByText(/clients include|trusted by/i)).toHaveCount(0);
  }
});

test('industry page: packages to start from and accessible layout', async ({ page }) => {
  await page.goto('/industries/retail-wholesale');
  await expect(page.getByRole('heading', { name: 'Packages to start from' })).toBeVisible();
  await expect(page.locator('[data-package]').first()).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'industry-retail');
  expect((await page.goto('/industries/no-such-sector'))!.status()).toBe(404);
});
