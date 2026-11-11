/**
 * P7.6 link check (docs/08 §5): crawl the public site from the home page and the sitemap. Every internal page link,
 * stylesheet, script, image and download answers below 400; no link is `#` or `javascript:`; no page links to a 404.
 * Private areas (/admin, /portal, /api, /i/, /q/, /pay) and mail/phone links are not followed.
 */
import { expect, test } from '@playwright/test';
import { ownIp } from './helpers';

test.use(ownIp('links'));
test.describe.configure({ timeout: 300_000 });

const SKIP = /^\/(admin|portal|api|i|q|pay|dev|cdn-cgi)(\/|$)/;
const MAX_PAGES = 400;

test('every internal link and asset on the public site resolves', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const queue: string[] = ['/'];
  const seenPages = new Set<string>(queue);
  const checked = new Map<string, number>();
  const problems: string[] = [];

  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = new URL(m[1]!).pathname;
    if (!seenPages.has(path)) {
      seenPages.add(path);
      queue.push(path);
    }
  }
  expect(queue.length).toBeGreaterThan(10);

  while (queue.length && seenPages.size <= MAX_PAGES) {
    const page = queue.shift()!;
    const res = await request.get(page);
    checked.set(page, res.status());
    if (res.status() >= 400) {
      problems.push(`${page}: HTTP ${res.status()}`);
      continue;
    }
    if (!(res.headers()['content-type'] ?? '').includes('text/html')) continue;
    const html = await res.text();
    for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
      const [, attr, raw] = m as unknown as [string, string, string];
      const value = raw.replace(/&amp;/g, '&');
      if (value === '#' || value === '' || /^javascript:/i.test(value)) {
        problems.push(`${page}: ${attr}="${raw}"`);
        continue;
      }
      if (/^(mailto|tel|data|blob):/i.test(value) || value.startsWith('#')) continue;
      const url = new URL(value, `${origin}${page}`);
      if (url.origin !== origin) continue;
      const path = `${url.pathname}${url.search}`;
      if (SKIP.test(url.pathname)) continue;
      const isPage =
        attr === 'href' &&
        !/\.(css|js|png|jpe?g|webp|avif|svg|ico|woff2?|pdf|xml|txt|webmanifest)$/i.test(url.pathname);
      if (isPage) {
        if (!seenPages.has(url.pathname)) {
          seenPages.add(url.pathname);
          queue.push(url.pathname);
        }
        continue;
      }
      if (!checked.has(path)) {
        const a = await request.get(path);
        checked.set(path, a.status());
        if (a.status() >= 400) problems.push(`${page}: ${attr} ${path} → HTTP ${a.status()}`);
      }
    }
  }
  console.info(`[links] ${seenPages.size} pages, ${checked.size} URLs checked`);
  expect(problems).toEqual([]);
});
