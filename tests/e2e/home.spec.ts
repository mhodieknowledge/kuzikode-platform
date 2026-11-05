import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

test.describe('home page', () => {
  test('renders every CMS section, hides Selected Work when empty, and passes the visual QA gate', async ({ page }) => {
    const res = await page.goto('/');
    expect(res!.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Building intelligent digital solutions.' }),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    for (const h of [
      'What we do',
      'Why Kuzikode',
      'How we work',
      'What we value',
      'Our products',
      'Have a project in mind?',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Selected work' })).toHaveCount(0);
    const services = page.locator('#services-title').locator('xpath=ancestor::section');
    await expect(services.getByRole('link')).toHaveCount(6);
    await expect(page.getByText('In Development', { exact: true })).toBeVisible();
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    const img = page.locator('img[fetchpriority="high"]');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('alt', /colleagues/);
    await expectAccessible(page);
    await screenshots(page, 'home');
  });

  test('primary actions point at real destinations', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await expect(hero.getByRole('link', { name: 'Start a project' })).toHaveAttribute('href', '/start-a-project');
    await expect(hero.getByRole('link', { name: 'Explore services' })).toHaveAttribute('href', '/services');
    await page
      .getByRole('link', { name: /Web Development & Digital Solutions/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/services\/web-development$/);
  });
});
