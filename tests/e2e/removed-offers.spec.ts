/**
 * The 2026-11 catalogue (R9.1, docs/redesign/REFINEMENTS.md §1 and §4): products, the Business Suite, care plans, hosting,
 * email, domain packages and the tech stack are gone from every public surface, and their old URLs redirect permanently
 * to the closest remaining page.
 */
import { expect, test } from '@playwright/test';
import { ownIp } from './helpers';

test.use(ownIp('removed-offers'));

const REDIRECTS: [from: string, to: string][] = [
  ['/products', '/services'],
  ['/products/business-suite', '/services'],
  ['/technologies', '/services'],
  ['/technologies/react', '/services'],
  ['/services/web-development', '/services/websites'],
  ['/services/mobile-desktop-apps', '/services/cross-platform-apps'],
  ['/services/cloud-it', '/services'],
];

test('removed URLs answer with a 301 to the closest remaining page', async ({ request }) => {
  for (const [from, to] of REDIRECTS) {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status(), from).toBe(301);
    expect(new URL(res.headers()['location']!, 'http://x').pathname, from).toBe(to);
  }
  // An unknown division is still a plain 404, not a redirect.
  expect((await request.get('/services/no-such-division', { maxRedirects: 0 })).status()).toBe(404);
});

test('public pages, search and the sitemap no longer offer removed services or a tech stack', async ({
  page,
  request,
}) => {
  const banned =
    /business suite|care plan|business email|email (and|&) domains?|domain registration|hosting|tools we build with|\/products|\/technologies/i;
  for (const path of ['/', '/services', '/pricing', '/how-we-work', '/about', '/faq', '/services/websites']) {
    expect((await page.goto(path))!.status(), path).toBe(200);
    const main = (await page.locator('main').textContent()) ?? '';
    expect(main, path).not.toMatch(banned);
    expect(await page.locator('a[href^="/products"], a[href^="/technologies"]').count(), path).toBe(0);
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toMatch(/\/products|\/technologies|web-development|cloud-it|mobile-desktop-apps/);
  for (const slug of [
    'websites',
    'business-software',
    'cross-platform-apps',
    'ai-data',
    'automation-integration',
    'add-ons',
  ])
    expect(sitemap).toContain(`/services/${slug}</loc>`);
  for (const q of ['hosting', 'care plan', 'business suite']) {
    await page.goto(`/search?q=${encodeURIComponent(q)}`);
    await expect(page.getByRole('region', { name: 'Search results' }).getByRole('status'), q).toContainText(
      'No results',
    );
  }
});
