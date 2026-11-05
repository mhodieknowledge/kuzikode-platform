import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { bumpContentVersionStmt, resetCmsCache } from '../../src/server/modules/cms';
import { seedBase } from '../helpers/seed';

const get = (path: string, headers: Record<string, string> = {}) =>
  exports.default.fetch(`http://localhost${path}`, { headers });

describe('public page cache', () => {
  it('caches public pages per content version with public headers and an ETag', async () => {
    await seedBase();
    resetCmsCache();
    const a = await get('/about');
    expect(a.headers.get('x-cache')).toBe('MISS');
    expect(a.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=300');
    const etag = a.headers.get('etag')!;
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    const body = await a.text();
    const b = await get('/about');
    expect(b.headers.get('x-cache')).toBe('HIT');
    expect(await b.text()).toBe(body);
    const notModified = await get('/about', { 'if-none-match': etag });
    expect(notModified.status).toBe(304);

    await bumpContentVersionStmt(env.DB).run();
    resetCmsCache();
    const c = await get('/about');
    expect(c.headers.get('x-cache')).toBe('MISS');
    expect(await c.text()).not.toBe(body);
  });

  it('never caches private paths, cookie-setting responses, errors or signed-in visitors', async () => {
    for (const path of ['/admin/x', '/portal', '/q/abc', '/i/abc', '/pay/abc']) {
      const r = await get(path);
      expect(r.headers.get('x-cache'), path).toBeNull();
    }
    for (let i = 0; i < 2; i++) {
      const r = await get('/with-cookie');
      expect(r.headers.get('x-cache')).toBeNull();
      expect(r.headers.get('cache-control')).toBeNull();
    }
    expect((await get('/missing')).headers.get('cache-control')).toBeNull();
    expect((await get('/services', { cookie: 'kz_portal_dev=abc' })).headers.get('x-cache')).toBeNull();
    const api = await get('/api/health');
    expect(api.headers.get('cache-control')).toBe('private, no-store');
  });
});
