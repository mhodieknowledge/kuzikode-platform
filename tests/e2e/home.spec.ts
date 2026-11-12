import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('home'));

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
    // Premium hero (BRIEF B.0e): the workspace window is one labelled illustration, and the route index lists all six divisions.
    await expect(page.getByRole('img', { name: /Illustration of the Kuzikode client workspace/ })).toBeVisible();
    const routes = page.getByRole('navigation', { name: 'Our six areas of work' });
    await expect(routes.getByRole('link')).toHaveCount(6);
    await expect(routes.getByRole('link', { name: /Web development\s+from \$350/ })).toHaveAttribute(
      'href',
      '/services/web-development',
    );
    await expectAccessible(page);
    await screenshots(page, 'home');
  });

  test('primary actions point at real destinations', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    // The CMS call to action still points at the retired wizard; it is presented as a quote request (BRIEF B.0c).
    await expect(hero.getByRole('link', { name: 'Get a quote' })).toHaveAttribute('href', '/contact');
    await expect(hero.getByRole('link', { name: 'Explore services' })).toHaveAttribute('href', '/services');
    await page
      .getByRole('link', { name: /Web Development & Digital Solutions/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/services\/web-development$/);
  });
});
