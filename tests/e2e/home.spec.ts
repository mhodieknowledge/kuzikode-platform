import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('home'));

/** Starting prices per featured division, from the 2026-11 catalogue (REFINEMENTS §1) through `divisionFromPrice`. */
const DIVISIONS = [
  { slug: 'websites', name: 'Websites & web apps', from: 'from $150' },
  { slug: 'business-software', name: 'Business software', from: 'from $600' },
  { slug: 'cross-platform-apps', name: 'Cross-platform apps', from: 'from $1,200' },
  { slug: 'ai-data', name: 'AI, data & intelligence', from: 'from $500' },
  { slug: 'automation-integration', name: 'Automation & integration', from: 'from $50 / local method' },
];

test.describe('home page (R10.3 rebuild)', () => {
  test('hero, service cards with section icons, bands and closing band', async ({ page }) => {
    const res = await page.goto('/');
    expect(res!.status()).toBe(200);
    // Hero: the CMS headline, the quote action, WhatsApp, a photograph background and the glass widgets.
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(
      hero.getByRole('heading', { level: 1, name: 'Building intelligent digital solutions.' }),
    ).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Get a quote' })).toHaveAttribute('href', '/contact');
    await expect(hero.locator('a[href^="https://wa.me/263778825898"]').first()).toBeVisible();
    await expect(hero.locator('.hm-bg img')).toHaveCount(1);
    await expect(hero.locator('.hm-chips a')).toHaveCount(5);
    await expect(hero.locator('.hm-glass--price')).toContainText('$150');

    // No division illustrations on the home page; section icons only.
    await expect(page.locator('svg[data-ill]')).toHaveCount(0);

    // Five service cards (Add-ons excluded): aria-hidden icon, "from" price only, link to the division page.
    const cards = page.locator('.hm-card');
    await expect(cards).toHaveCount(5);
    await expect(page.locator('.hm-services')).not.toContainText('Add-ons');
    for (const d of DIVISIONS) {
      const c = page.locator(`.hm-card[data-service="${d.slug}"]`);
      await expect(c.locator('.hm-card__tab')).toHaveText(
        new RegExp(d.from.replace('from', 'From').replace('$', '\\$')),
      );
      await expect(c.getByRole('link', { name: d.name })).toHaveAttribute('href', `/services/${d.slug}`);
      await expect(c.locator('.hm-card__icon[aria-hidden="true"] svg')).toHaveCount(1);
    }
    await expect(page.locator('.hm-services').getByRole('link', { name: 'See all services' })).toHaveAttribute(
      'href',
      '/services',
    );
    await expect(page.locator('main')).not.toContainText('Starter Website');
    await expect(page.locator('.hm-services img')).toHaveCount(0);

    // Photographs only as backgrounds under an overlay (REFINEMENTS §3).
    for (const band of ['.hm-hero', '.hm-close']) {
      await expect(page.locator(`${band} > .kz-pic`)).toHaveCount(1);
    }
    await expect(page.locator('.kz-pstrip')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Why Kuzikode' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'How we work' })).toBeVisible();
    const pe = page.locator('section[aria-labelledby="pe-title"]');
    await expect(pe.getByRole('link', { name: 'See pricing' })).toHaveAttribute('href', '/pricing');
    await expect(pe.locator('.hm-pe__rows li')).toHaveCount(5);

    // Closing band: one quote action and the Settings contact options; the footer's own band is off on the home page.
    const close = page.locator('section[aria-labelledby="close-title"]');
    await expect(close.getByRole('heading', { name: 'Have a project in mind?' })).toBeVisible();
    await expect(close.getByRole('link', { name: 'Get a quote' })).toHaveAttribute('href', '/contact');
    await expect(close.locator('a[href^="https://wa.me/263778825898"]').first()).toBeVisible();
    await expect(close.locator('a[href="tel:+263882946290"]')).toBeVisible();
    await expect(close.locator('a[href="mailto:info@kuzikode.com"]')).toBeVisible();
    await expect(page.locator('.kz-footer__next')).toHaveCount(0);

    // No products, no tech stack, no unpublished work, no dead links (REFINEMENTS §1, §4).
    await expect(page.getByRole('heading', { name: 'Selected work' })).toHaveCount(0);
    await expect(page.locator('a[href^="/products"], a[href="#"]')).toHaveCount(0);
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const word of [
      'astro',
      'react',
      'cloudflare',
      'typescript',
      'node.js',
      'flutter',
      'laravel',
      'tech stack',
      'tools we build with',
    ]) {
      expect(text, `tech-stack word "${word}"`).not.toContain(word);
    }
    await expectAccessible(page);
    await screenshots(page, 'home');
  });

  test('a service card opens its division page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page
      .locator('.hm-card[data-service="ai-data"]')
      .getByRole('link', { name: 'AI, data & intelligence' })
      .click();
    await expect(page).toHaveURL(/\/services\/ai-data$/);
  });

  test('no horizontal overflow at phone, tablet and desktop widths', async ({ page }) => {
    for (const [width, height] of [
      [360, 740],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow @ ${width}`).toBeLessThanOrEqual(0);
      // Tap targets: chips, buttons and contact rows are at least 44 px tall.
      const short = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '.hm-chips a, .hm-close__rows a, .hm-hero .hm-cta, .hm-hero .hm-ghost, .hm-more a, .hm-pe__cta',
          ),
        )
          .filter((a) => a.getBoundingClientRect().height < 44)
          .map((a) => a.textContent?.trim()),
      );
      expect(short, `tap targets under 44 px @ ${width}`).toEqual([]);
    }
  });
});
