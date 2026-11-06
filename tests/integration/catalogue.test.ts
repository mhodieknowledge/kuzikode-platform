import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { contentVersion, getServiceCatalogue, resetCmsCache } from '../../src/server/modules/cms';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const ctx = () => createContext({ env });
async function session(roles: string[]) {
  const u = await createStaff(roles);
  return login('admin', u.email, u.password);
}
const division = (over: Record<string, unknown> = {}) => ({
  slug: 'training',
  name: 'Training & Workshops',
  summary: 'Hands-on training for teams adopting new systems.',
  description: '<p>Practical sessions.</p><script>alert(1)</script><p onclick="x()">Hands-on.</p>',
  benefits: [{ title: 'Learn by doing', body: 'Every session uses your own data.' }],
  deliverables: ['Course notes'],
  faq: [{ q: 'Is it online?', a: 'Online or on site.' }],
  icon: 'sparkles',
  status: 'active',
  featured: false,
  seoTitle: '',
  seoDescription: '',
  ...over,
});
const service = (categoryId: string, over: Record<string, unknown> = {}) => ({
  categoryId,
  slug: 'power-bi-basics',
  name: 'Power BI basics',
  summary: 'A one-day introduction to dashboards for managers.',
  description: '',
  pricingModel: 'fixed',
  priceMinor: 25_000,
  currency: 'USD',
  status: 'active',
  featured: false,
  ...over,
});

describe('services management (P4.6)', () => {
  beforeEach(async () => {
    await seedBase();
    resetCmsCache();
  });

  it('creates a division and a service; the public catalogue shows them at once (content_version bump), sanitized and audited', async () => {
    const s = await session(['content_manager']);
    const v0 = await contentVersion(ctx());
    const before = await getServiceCatalogue(ctx());
    const d = await api('/api/v1/admin/catalogue/categories', { cookie: s.cookie, csrf: s.csrf, body: division() });
    expect(d.status).toBe(201);
    const catId = d.body.data.id as string;
    const sv = await api('/api/v1/admin/catalogue/services', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: service(catId),
    });
    expect(sv.status).toBe(201);
    resetCmsCache();
    expect(await contentVersion(ctx())).toBe(v0 + 2);
    const after = await getServiceCatalogue(ctx());
    expect(after.length).toBe(before.length + 1);
    const pub = after.find((c) => c.slug === 'training')!;
    // New divisions go last; script and event handlers are stripped.
    expect(after.at(-1)!.slug).toBe('training');
    expect(pub.description).toBe('<p>Practical sessions.</p><p>Hands-on.</p>');
    expect(pub.benefits).toEqual([{ title: 'Learn by doing', body: 'Every session uses your own data.' }]);
    expect(pub.services).toEqual([
      expect.objectContaining({ slug: 'power-bi-basics', pricingModel: 'fixed', priceMinor: 25_000, currency: 'USD' }),
    ]);
    const audits = await env.DB.prepare('SELECT action FROM audit_logs WHERE entity_id IN (?, ?) ORDER BY created_at')
      .bind(catId, sv.body.data.id)
      .all<{ action: string }>();
    expect(audits.results.map((r) => r.action)).toEqual(['service_category.created', 'service.created']);

    // Hidden services disappear from the public site; coming-soon ones stay with their status.
    const put = await api(`/api/v1/admin/catalogue/services/${sv.body.data.id}`, {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: service(catId, { status: 'inactive' }),
    });
    expect(put.status).toBe(200);
    expect((await getServiceCatalogue(ctx())).find((c) => c.slug === 'training')!.services).toEqual([]);
  });

  it('validates pricing, slugs and duplicates; custom quotes store no price', async () => {
    const s = await session(['admin']);
    const cat = (await env.DB.prepare("SELECT id FROM service_categories WHERE slug = 'ai-data'").first<{
      id: string;
    }>())!.id;
    const noPrice = await api('/api/v1/admin/catalogue/services', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: service(cat, { priceMinor: null, currency: null }),
    });
    expect(noPrice.status).toBe(422);
    expect(Object.keys(noPrice.body.error.fields).sort()).toEqual(['currency', 'priceMinor']);
    const badSlug = await api('/api/v1/admin/catalogue/services', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: service(cat, { slug: 'Bad Slug' }),
    });
    expect(badSlug.status).toBe(422);
    const existing = (await env.DB.prepare('SELECT slug FROM services WHERE category_id = ? LIMIT 1')
      .bind(cat)
      .first<{ slug: string }>())!.slug;
    const dup = await api('/api/v1/admin/catalogue/services', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: service(cat, { slug: existing }),
    });
    expect(dup.status).toBe(422);
    expect(dup.body.error.fields.slug).toEqual(['That web address is already in use.']);
    const quote = await api('/api/v1/admin/catalogue/services', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: service(cat, { slug: 'custom-ml', pricingModel: 'custom_quote', priceMinor: 999 }),
    });
    expect(quote.status).toBe(201);
    const row = await env.DB.prepare('SELECT price_minor, currency FROM services WHERE id = ?')
      .bind(quote.body.data.id)
      .first();
    expect(row).toEqual({ price_minor: null, currency: null });
    const dupDivision = await api('/api/v1/admin/catalogue/categories', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: division({ slug: 'ai-data' }),
    });
    expect(dupDivision.status).toBe(422);
  });

  it('reorders divisions and services; a stale list is rejected', async () => {
    const s = await session(['admin']);
    const ids = (
      await env.DB.prepare('SELECT id FROM service_categories ORDER BY sort_order').all<{ id: string }>()
    ).results.map((r) => r.id);
    const reversed = [...ids].reverse();
    const res = await api('/api/v1/admin/catalogue/categories/order', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { ids: reversed },
    });
    expect(res.status).toBe(200);
    expect((await getServiceCatalogue(ctx())).map((c) => c.id)).toEqual(reversed);
    const stale = await api('/api/v1/admin/catalogue/categories/order', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { ids: reversed.slice(1) },
    });
    expect(stale.status).toBe(409);

    const cat = ids[0]!;
    const svcIds = (
      await env.DB.prepare('SELECT id FROM services WHERE category_id = ? ORDER BY sort_order')
        .bind(cat)
        .all<{ id: string }>()
    ).results.map((r) => r.id);
    const rotated = [...svcIds.slice(1), svcIds[0]!];
    expect(
      (
        await api(`/api/v1/admin/catalogue/categories/${cat}/services/order`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { ids: rotated },
        })
      ).status,
    ).toBe(200);
    const pub = (await getServiceCatalogue(ctx())).find((c) => c.id === cat)!;
    expect(pub.services.map((x) => x.id)).toEqual(rotated);
  });

  it('deletes only unused services and empty divisions; needs services.manage', async () => {
    const s = await session(['admin']);
    const used = (await env.DB.prepare('SELECT service_id FROM service_packages LIMIT 1').first<{
      service_id: string;
    }>())!.service_id;
    const del = await api(`/api/v1/admin/catalogue/services/${used}`, {
      method: 'DELETE',
      cookie: s.cookie,
      csrf: s.csrf,
    });
    expect(del.status).toBe(409);
    const busyCat = (await env.DB.prepare('SELECT category_id FROM services LIMIT 1').first<{ category_id: string }>())!
      .category_id;
    expect(
      (await api(`/api/v1/admin/catalogue/categories/${busyCat}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf }))
        .status,
    ).toBe(409);

    const d = await api('/api/v1/admin/catalogue/categories', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: division({ slug: 'temp-division' }),
    });
    const sv = await api('/api/v1/admin/catalogue/services', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: service(d.body.data.id, { slug: 'temp-service' }),
    });
    expect(
      (
        await api(`/api/v1/admin/catalogue/services/${sv.body.data.id}`, {
          method: 'DELETE',
          cookie: s.cookie,
          csrf: s.csrf,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api(`/api/v1/admin/catalogue/categories/${d.body.data.id}`, {
          method: 'DELETE',
          cookie: s.cookie,
          csrf: s.csrf,
        })
      ).status,
    ).toBe(200);
    expect(await env.DB.prepare("SELECT 1 FROM service_categories WHERE slug = 'temp-division'").first()).toBeNull();

    const support = await session(['support_staff']);
    expect((await api('/api/v1/admin/catalogue', { cookie: support.cookie })).status).toBe(403);
  });
});
