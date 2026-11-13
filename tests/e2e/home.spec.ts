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
    for (const h of ['What we do', 'Why Kuzikode', 'How we work', 'What we value', 'Have a project in mind?']) {
      await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Selected work' })).toHaveCount(0);
    // No products and no tech stack on public pages (REFINEMENTS §1, §4).
    await expect(page.getByRole('heading', { name: 'Our products' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Tools we build with' })).toHaveCount(0);
    await expect(page.locator('a[href^="/products"]')).toHaveCount(0);
    // Services night band (R4.1): one route tab per featured division (the Add-ons division is not a home widget);
    // each panel shows the division's published packages and prices.
    const tabs = page.getByRole('tablist', { name: 'Area of work' }).getByRole('tab');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.filter({ hasText: 'Add-ons' })).toHaveCount(0);
    const web = page.getByRole('tabpanel', { name: /Websites & web apps/ });
    await expect(web.getByText('Starter Website')).toBeVisible();
    await expect(web.getByText('$150', { exact: true })).toBeVisible();
    // Division panels carry their Route drawing (BRIEF B.4a), never a photograph.
    await expect(web.locator('svg[data-ill="web-development"]')).toHaveCount(1);
    await expect(page.locator('.kz-band__panel img')).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    // Premium hero (BRIEF B.0e): the workspace window is one labelled illustration, and the route index lists the five divisions.
    await expect(page.getByRole('img', { name: /Illustration of the Kuzikode client workspace/ })).toBeVisible();
    const routes = page.getByRole('navigation', { name: 'Our areas of work' });
    await expect(routes.getByRole('link')).toHaveCount(5);
    await expect(routes.getByRole('link', { name: /Websites & web apps\s+from \$150/ })).toHaveAttribute(
      'href',
      '/services/websites',
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
    // Route tabs switch the panel; the panel's actions preselect the division on the contact form.
    await page.getByRole('tab', { name: /Automation/ }).click();
    const auto = page.getByRole('tabpanel', { name: /Automation/ });
    await expect(auto).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: /Websites & web apps/ })).toBeHidden();
    await expect(auto.getByRole('link', { name: 'Get a quote' })).toHaveAttribute(
      'href',
      '/contact?category=automation-integration',
    );
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: /AI, data/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /Websites & web apps/ }).click();
    await page
      .getByRole('tabpanel', { name: /Websites & web apps/ })
      .getByRole('link', { name: /Open Websites & web apps/ })
      .click();
    await expect(page).toHaveURL(/\/services\/websites$/);
  });
});
