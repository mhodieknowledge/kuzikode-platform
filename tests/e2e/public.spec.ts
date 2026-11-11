import { expect, test } from '@playwright/test';
import { ownIp } from './helpers';

test.use(ownIp('public'));

const PUBLIC = [
  '/',
  '/about',
  '/services',
  '/services/web-development',
  '/work',
  '/products',
  '/contact',
  '/legal/privacy',
];

test.describe('SEO', () => {
  test('every public page has a title, description, canonical, OG/Twitter tags and Organization JSON-LD', async ({
    page,
  }) => {
    for (const path of PUBLIC) {
      await page.goto(path);
      const title = await page.title();
      expect(title.length, `${path} title`).toBeGreaterThan(10);
      expect(title.length, `${path} title length`).toBeLessThanOrEqual(70);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`${path === '/' ? '/$' : `${path}$`}`),
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        /\/brand\/og\/[a-z0-9-]+\.png$/,
      );
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
      const data = JSON.parse(ld!) as Record<string, unknown>[];
      expect(data.some((d) => d['@type'] === 'Organization')).toBe(true);
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });

  test('home adds WebSite; division pages add Service + BreadcrumbList', async ({ page }) => {
    await page.goto('/');
    expect(
      JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!).map((d: any) => d['@type']),
    ).toContain('WebSite');
    await page.goto('/services/cloud-it');
    const types = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!).map(
      (d: any) => d['@type'],
    );
    expect(types).toEqual(expect.arrayContaining(['Organization', 'Service', 'BreadcrumbList']));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /services-cloud-it\.png$/);
  });

  test('sitemap lists published pages and robots keeps private paths out', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<urlset');
    for (const p of ['/about</loc>', '/services/web-development</loc>', '/legal/privacy</loc>'])
      expect(sitemap).toContain(p);
    expect(sitemap).not.toMatch(/\/admin|\/portal|\/api\//);
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: ');
    // Non-production environments disallow everything; production lists the private paths.
    expect(robots).toMatch(/Disallow: \/(\n|$)|Disallow: \/admin/);
  });

  test('unknown pages return a helpful 404 that is not indexed', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist');
    expect(res!.status()).toBe(404);
    await expect(page.getByRole('heading', { name: "We couldn't find that page." })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});
