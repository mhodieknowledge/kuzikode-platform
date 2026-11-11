import { describe, expect, it } from 'vitest';
import { checksFor, evaluate, smoke } from '../../scripts/smoke.mjs';

const SECURITY = {
  'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

/** A fake deployment that answers every smoke check correctly for the given env. */
function healthySite(env: 'staging' | 'production') {
  const security = env === 'production' ? { ...SECURITY, 'strict-transport-security': 'max-age=63072000' } : SECURITY;
  const priv = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };
  const html = { 'content-type': 'text/html; charset=utf-8' };
  const pages: Record<string, [number, Record<string, string>, string]> = {
    '/api/health': [200, { 'content-type': 'application/json', ...priv }, '{"data":{"status":"ok"}}'],
    '/': [200, { ...html, ...security }, '<h1>Kuzikode</h1>'],
    '/services/': [200, html, 'Kuzikode services'],
    '/pricing': [200, html, ''],
    '/contact': [200, html, '&quot;siteKey&quot;:[0,&quot;0x4AAAA&quot;]'],
    '/legal/privacy': [200, html, ''],
    '/admin/login': [200, { ...html, ...security, ...priv }, ''],
    '/portal/login': [200, { ...html, ...priv }, ''],
    '/robots.txt': [
      200,
      { 'content-type': 'text/plain' },
      env === 'production'
        ? 'User-agent: *\nAllow: /\nSitemap: https://kuzikode.com/sitemap.xml\n'
        : 'User-agent: *\nDisallow: /\n',
    ],
    '/sitemap.xml': [200, { 'content-type': 'application/xml' }, '<urlset></urlset>'],
  };
  return (async (url: string) => {
    const page = pages[new URL(url).pathname] ?? [404, html, 'Not found'];
    return new Response(page[2], { status: page[0], headers: page[1] });
  }) as unknown as typeof fetch;
}

describe('post-deploy smoke test', () => {
  it('passes against a healthy staging and production deployment', async () => {
    for (const env of ['staging', 'production'] as const) {
      expect(await smoke('https://example.test', { env, fetchImpl: healthySite(env), delayMs: 0 })).toEqual([]);
    }
  });

  it('production requires HSTS, a real Turnstile key and an indexable robots.txt', async () => {
    const failures = await smoke('https://example.test', {
      env: 'production',
      fetchImpl: healthySite('staging'),
      delayMs: 0,
    });
    expect(failures.map((f) => f.path).sort()).toEqual(['/', '/admin/login', '/robots.txt']);
    const testKey = evaluate(
      checksFor('production').find((c) => c.path === '/contact')!,
      new Response('', { headers: { 'content-type': 'text/html' } }),
      '&quot;siteKey&quot;:[0,&quot;1x00000000000000000000AA&quot;]',
    );
    expect(testKey).toHaveLength(1);
  });

  it('retries 429 and 5xx, then reports the last error', async () => {
    let calls = 0;
    const flaky = (async (url: string) => {
      calls++;
      if (calls <= 2) return new Response('rate limited', { status: 429 });
      return healthySite('staging')(url);
    }) as unknown as typeof fetch;
    expect(await smoke('https://example.test', { env: 'staging', fetchImpl: flaky, delayMs: 0 })).toEqual([]);

    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const failures = await smoke('https://example.test', { env: 'staging', fetchImpl: down, attempts: 2, delayMs: 0 });
    expect(failures).toHaveLength(checksFor('staging').length);
    expect(failures[0]!.errors[0]).toBe('status 503, expected 200');
  });

  it('reports missing and wrong headers by name', () => {
    const check = checksFor('staging').find((c) => c.path === '/admin/login')!;
    const errors = evaluate(
      check,
      new Response('', { headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=60' } }),
      '',
    );
    expect(errors).toContain('missing header x-frame-options');
    expect(errors).toContain('header cache-control = "public, max-age=60"');
  });
});
