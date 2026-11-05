import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

test('insights index, category and tag listings', async ({ page, request }) => {
  expect((await page.goto('/insights'))!.status()).toBe(200);
  const articles = page.getByRole('region', { name: 'Articles' }).getByRole('article');
  await expect(articles).toHaveCount(4);
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    'href',
    '/insights/rss.xml',
  );
  await expectAccessible(page);
  await screenshots(page, 'insights');

  await page.getByRole('navigation', { name: 'Insight categories' }).getByRole('link', { name: 'Payments' }).click();
  await expect(page).toHaveURL(/\/insights\/category\/payments$/);
  await expect(articles).toHaveCount(1);
  await expect(
    page.getByRole('navigation', { name: 'Insight categories' }).getByRole('link', { name: 'Payments' }),
  ).toHaveAttribute('aria-current', 'page');
  expect((await request.get('/insights/category/nope')).status()).toBe(404);
  expect((await request.get('/insights/tag/nope')).status()).toBe(404);
  expect((await request.get('/insights/no-such-article')).status()).toBe(404);
});

test('article page: Article JSON-LD, tags, share links, related posts', async ({ page }) => {
  await page.goto('/insights');
  await page.getByRole('link', { name: 'Business email on your own domain: why and how' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Business email on your own domain: why and how');
  await expect(page.locator('header').getByText(/By Kuzikode Technologies/)).toContainText('min read');
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(
    (t) => JSON.parse(t) as Record<string, unknown>[],
  );
  const article = ld.find((x) => x['@type'] === 'Article')!;
  expect(article).toMatchObject({ headline: 'Business email on your own domain: why and how' });
  expect(String(article['datePublished'])).toMatch(/^2026-11-05T/);
  await expect(page.getByRole('heading', { name: 'Related articles' })).toBeVisible();
  await expect(page.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('list', { name: 'Tags' }).getByRole('link', { name: 'Email' }).click();
  await expect(page).toHaveURL(/\/insights\/tag\/email$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Email');
  await page.goto('/insights/business-email-on-your-own-domain');
  await expectAccessible(page);
  await screenshots(page, 'insights-article');
});

test('RSS feed is well-formed RSS 2.0 with every article', async ({ page, request }) => {
  const res = await request.get('/insights/rss.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/rss+xml');
  const body = await res.text();
  await page.goto('/');
  const parsed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return {
      error: doc.getElementsByTagName('parsererror').length,
      version: doc.documentElement.getAttribute('version'),
      title: doc.querySelector('channel > title')?.textContent,
      items: [...doc.querySelectorAll('item')].map((i) => ({
        link: i.querySelector('link')?.textContent ?? '',
        pubDate: i.querySelector('pubDate')?.textContent ?? '',
      })),
    };
  }, body);
  expect(parsed.error).toBe(0);
  expect(parsed.version).toBe('2.0');
  expect(parsed.title).toContain('Insights');
  expect(parsed.items).toHaveLength(4);
  for (const i of parsed.items) {
    expect(i.link).toMatch(/\/insights\/[a-z0-9-]+$/);
    expect(Number.isNaN(Date.parse(i.pubDate))).toBe(false);
    expect((await request.get(new URL(i.link).pathname)).status()).toBe(200);
  }
});
