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

test.describe('home page (R9.6)', () => {
  test('hero, division widgets, image bands and closing band', async ({ page }) => {
    const res = await page.goto('/');
    expect(res!.status()).toBe(200);
    // Hero: the CMS headline, one primary and one secondary action, a photograph and the overlay widgets.
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(
      hero.getByRole('heading', { level: 1, name: 'Building intelligent digital solutions.' }),
    ).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Get a quote' })).toHaveAttribute('href', '/contact');
    await expect(hero.getByRole('link', { name: 'See pricing' })).toHaveAttribute('href', '/pricing');
    await expect(hero.locator('.kz-hero__img img')).toHaveCount(1);
    await expect(hero.getByRole('img', { name: /Illustration of the Kuzikode client workspace/ })).toBeVisible();

    // Five division widgets (Add-ons excluded), each with its drawing, a "from" price only, its link and a jump anchor.
    const widgets = page.locator('.kz-area');
    await expect(widgets).toHaveCount(5);
    await expect(page.locator('.kz-areas')).not.toContainText('Add-ons');
    const jump = page.getByRole('navigation', { name: 'Jump to an area of work' });
    for (const d of DIVISIONS) {
      const w = page.locator(`#area-${d.slug}`);
      await expect(w.locator('.kz-area__from')).toHaveText(d.from);
      await expect(w.getByRole('link', { name: d.name })).toHaveAttribute('href', `/services/${d.slug}`);
      await expect(w.locator('svg[data-ill]')).toHaveCount(1);
      await expect(jump.getByRole('link', { name: d.name })).toHaveAttribute('href', `#area-${d.slug}`);
    }
    // No price lists on the home page: one price per widget, no package names.
    await expect(page.locator('main')).not.toContainText('Starter Website');
    await expect(page.locator('.kz-areas img')).toHaveCount(0);

    // Image bands: photographs only under an overlay with content and widgets on top (REFINEMENTS §3).
    for (const band of ['.kz-hero', '.kz-why', '.kz-close']) {
      await expect(page.locator(`${band} > .kz-pic`)).toHaveCount(1);
    }
    await expect(page.locator('.kz-pstrip')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Why Kuzikode' })).toBeVisible();
    await expect(page.getByRole('img', { name: /payment of \$250\.00/ })).toBeAttached();
    await expect(page.getByRole('heading', { level: 2, name: 'How we work' })).toBeVisible();

    // Closing band: one quote action and the Settings contact options; the footer's own band is off on the home page.
    const close = page.locator('section[aria-labelledby="close-title"]');
    await expect(close.getByRole('heading', { name: 'Have a project in mind?' })).toBeVisible();
    await expect(close.getByRole('link', { name: 'Get a quote' })).toHaveAttribute('href', '/contact');
    await expect(close.locator('a[href^="https://wa.me/263778825898"]')).toBeVisible();
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

  test('jump row anchors to a division widget and the widget opens its page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Jump to an area of work' })
      .getByRole('link', { name: 'AI, data & intelligence' })
      .click();
    await expect(page).toHaveURL(/#area-ai-data$/);
    await expect(page.locator('#area-ai-data')).toBeInViewport();
    await page.locator('#area-ai-data').getByRole('link', { name: 'AI, data & intelligence' }).click();
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
      // Tap targets: the jump links, widget links and contact options are at least 44 px tall.
      const short = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('.kz-areas__jump a, .kz-close__option, .kz-hero .kz-btn'))
          .filter((a) => a.getBoundingClientRect().height < 44)
          .map((a) => a.textContent?.trim()),
      );
      expect(short, `tap targets under 44 px @ ${width}`).toEqual([]);
    }
  });
});
