import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { getPricingCatalogue, resetCmsCache } from '../../src/server/modules/cms';
import { api, login } from '../helpers/api';
import { createClient, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const P = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/packages${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();
const version = async () =>
  Number((await row("SELECT value FROM application_settings WHERE key = 'content_version'")).value);

const pkg = (over: Record<string, unknown> = {}) => ({
  serviceId: 'svc_web_development__business_websites',
  slug: 'landing-page',
  name: 'Landing Page',
  tagline: 'One page that converts.',
  billingType: 'one_off',
  priceType: 'fixed',
  priceMinor: 20_000,
  currency: 'USD',
  altPriceZwgMinor: 5_400_000,
  tab: 'websites',
  status: 'active',
  deliveryTime: '1 week',
  costNote: 'Hosting on our shared plan.',
  features: [
    { label: 'Pages', value: 'text', text: '1', key: 'pages' },
    { label: 'Mobile-responsive design', value: 'included', key: 'responsive' },
    { label: 'Blog', value: 'not_included', key: 'blog' },
  ],
  ...over,
});

describe('packages & pricing admin (P4.19)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
    resetCmsCache();
  });

  it('creates and edits packages with ordered features; every write bumps the content version and is audited', async () => {
    const content = await staff(['content_manager']);
    const v0 = await version();
    const res = await P(content, '', pkg());
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const id = res.body.data.id as string;
    expect(await version()).toBe(v0 + 1);
    const got = (await P(content, `/${id}`)).body.data;
    expect(got).toMatchObject({ name: 'Landing Page', priceMinor: 20_000, tab: 'websites', priceReviewRequired: true });
    expect(got.features.map((f: any) => [f.label, f.value, f.text])).toEqual([
      ['Pages', 'text', '1'],
      ['Mobile-responsive design', 'included', null],
      ['Blog', 'not_included', null],
    ]);
    // Same slug in the same service → field error; a text feature needs its value; custom quote needs no price.
    expect((await P(content, '', pkg())).body.error.fields.slug).toBeTruthy();
    expect((await P(content, '', pkg({ slug: 'x2', features: [{ label: 'Pages', value: 'text' }] }))).status).toBe(422);
    expect(
      (await P(content, '', pkg({ slug: 'bespoke', priceType: 'custom_quote', priceMinor: null, currency: null })))
        .status,
    ).toBe(201);
    // Edit: reorder features, rename.
    const edit = await P(
      content,
      `/${id}`,
      pkg({ name: 'Landing Page Plus', features: pkg().features.slice().reverse() }),
      'PUT',
    );
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    const after = (await P(content, `/${id}`)).body.data;
    expect(after.features.map((f: any) => f.label)).toEqual(['Blog', 'Mobile-responsive design', 'Pages']);
    expect(
      (await row("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'package' AND entity_id = ?", id)).n,
    ).toBe(2);
    // The cost note is internal: the public catalogue never carries it.
    resetCmsCache();
    const pub = await getPricingCatalogue(createContext({ env }));
    expect(JSON.stringify(pub)).not.toContain('Hosting on our shared plan');
    expect(JSON.stringify(pub)).toContain('Landing Page Plus');
  });

  it('price review: non-reviewers flag price changes, reviewers approve (audited), the dashboard warns meanwhile', async () => {
    const content = await staff(['content_manager']);
    const admin = await staff(['admin']);
    const id = (await P(admin, '', pkg({ slug: 'reviewed' }))).body.data.id as string;
    expect((await row('SELECT price_review_required AS r FROM service_packages WHERE id = ?', id)).r).toBe(0);
    // A wording change by a non-reviewer keeps the approval; a price change resets it.
    await P(content, `/${id}`, pkg({ slug: 'reviewed', tagline: 'New words' }), 'PUT');
    expect((await row('SELECT price_review_required AS r FROM service_packages WHERE id = ?', id)).r).toBe(0);
    await P(content, `/${id}`, pkg({ slug: 'reviewed', priceMinor: 25_000 }), 'PUT');
    expect((await row('SELECT price_review_required AS r FROM service_packages WHERE id = ?', id)).r).toBe(1);
    expect(
      await row("SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'package.price_changed'", id),
    ).toBeTruthy();
    expect((await P(content, '/approve-prices', { ids: [id] })).status).toBe(403);
    const flagged = (await api('/api/v1/admin/dashboard', { cookie: admin.cookie })).body.data.priceReview as number;
    expect(flagged).toBeGreaterThan(0); // the seeded catalogue + this one
    expect((await P(admin, '/approve-prices', { ids: [id] })).body.data.approved).toBe(1);
    expect((await row('SELECT price_review_required AS r FROM service_packages WHERE id = ?', id)).r).toBe(0);
    expect(
      await row("SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'package.price_approved'", id),
    ).toBeTruthy();
    const all = await P(admin, '/approve-prices', {});
    expect(all.body.data.approved).toBe(flagged - 1);
    expect((await api('/api/v1/admin/dashboard', { cookie: admin.cookie })).body.data.priceReview).toBe(0);
  });

  it('keeps one "most popular" per tab and saves the comparison order', async () => {
    const admin = await staff(['admin']);
    const a = (await P(admin, '', pkg({ slug: 'pop-a', mostPopular: true }))).body.data.id;
    expect(
      (await row("SELECT COUNT(*) AS n FROM service_packages WHERE pricing_tab = 'websites' AND most_popular = 1")).n,
    ).toBe(1);
    expect((await row('SELECT most_popular FROM service_packages WHERE id = ?', a)).most_popular).toBe(1);
    const tab = (await P(admin, '')).body.data.packages.filter((p: any) => p.tab === 'websites').map((p: any) => p.id);
    const reversed = [...tab].reverse();
    expect((await P(admin, '/order', { tab: 'websites', ids: reversed })).status).toBe(200);
    const now = (await P(admin, '')).body.data.packages.filter((p: any) => p.tab === 'websites').map((p: any) => p.id);
    expect(now).toEqual(reversed);
    expect((await P(admin, '/order', { tab: 'websites', ids: reversed.slice(1) })).status).toBe(409);
  });

  it('"Add package" copies prices into the quotation: later catalogue changes never alter it', async () => {
    const admin = await staff(['admin']);
    const id = (await P(admin, '', pkg({ slug: 'copy-test' }))).body.data.id as string;
    const addon = (
      await P(admin, '/addons', {
        packageId: id,
        name: 'Extra section',
        priceMinor: 3_000,
        currency: 'USD',
        unit: 'each',
        billingType: 'one_off',
      })
    ).body.data.id as string;
    const lines = await P(admin, `/${id}/quote-lines`, {
      currency: 'USD',
      addons: [
        { id: addon, quantity: 2 },
        { id: 'pad_extra_mailbox', quantity: 3 },
      ],
    });
    expect(lines.status, JSON.stringify(lines.body)).toBe(200);
    const items = lines.body.data;
    expect(items[0]).toMatchObject({ packageId: id, unitPriceMinor: 20_000, quantity: '1', isRecurring: false });
    expect(items[0].description).toContain('Includes: Pages: 1; Mobile-responsive design.');
    expect(items[0].description).not.toContain('Blog');
    expect(items.slice(1).map((l: any) => [l.unitPriceMinor, l.quantity, l.isRecurring, l.recurringInterval])).toEqual([
      [3_000, '2', false, null],
      [3_000, '3', true, 'year'],
    ]);
    const { id: clientId } = await createClient();
    const q = await api('/api/v1/admin/quotations', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { clientId, title: 'Landing page', currency: 'USD', items },
    });
    expect(q.status, JSON.stringify(q.body)).toBe(201);
    const qid = q.body.data.id as string;
    const before = (await row('SELECT total_minor FROM quotations WHERE id = ?', qid)).total_minor;
    expect(before).toBe(20_000 + 6_000 + 9_000);
    // Raise the catalogue price: the quotation keeps the copied price; new quote lines use the new one.
    await P(admin, `/${id}`, pkg({ slug: 'copy-test', priceMinor: 99_000 }), 'PUT');
    expect((await row('SELECT total_minor FROM quotations WHERE id = ?', qid)).total_minor).toBe(before);
    expect(
      await row('SELECT unit_price_minor FROM quotation_items WHERE quotation_id = ? ORDER BY position LIMIT 1', qid),
    ).toEqual({ unit_price_minor: 20_000 });
    expect((await P(admin, `/${id}/quote-lines`, { currency: 'USD' })).body.data[0].unitPriceMinor).toBe(99_000);
    // ZWG uses the manual ZWG price; a currency without a price, or a mismatched add-on, is refused.
    expect((await P(admin, `/${id}/quote-lines`, { currency: 'ZWG' })).body.data[0].unitPriceMinor).toBe(5_400_000);
    expect(
      (await P(admin, `/${id}/quote-lines`, { currency: 'ZWG', addons: [{ id: addon, quantity: 1 }] })).status,
    ).toBe(422);
    const noZwg = (await P(admin, '', pkg({ slug: 'usd-only', altPriceZwgMinor: null }))).body.data.id;
    expect((await P(admin, `/${noZwg}/quote-lines`, { currency: 'ZWG' })).status).toBe(422);
    // A package used by a quotation can't be deleted; an unused one can.
    expect((await P(admin, `/${id}`, undefined, 'DELETE')).status).toBe(409);
    expect((await P(admin, `/${noZwg}`, undefined, 'DELETE')).status).toBe(200);
    expect(await row('SELECT id FROM service_packages WHERE id = ?', noZwg)).toBeNull();
  });

  it('add-ons: create, edit, deactivate, delete; permissions enforced', async () => {
    const admin = await staff(['admin']);
    const created = await P(admin, '/addons', {
      name: 'Translation',
      priceMinor: 1_500,
      currency: 'USD',
      unit: 'page',
      billingType: 'one_off',
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect(
      (
        await P(
          admin,
          `/addons/${id}`,
          {
            name: 'Translation',
            priceMinor: 1_800,
            currency: 'USD',
            unit: 'page',
            billingType: 'one_off',
            active: false,
          },
          'PUT',
        )
      ).status,
    ).toBe(200);
    expect(await row('SELECT price_minor, active FROM package_addons WHERE id = ?', id)).toEqual({
      price_minor: 1_800,
      active: 0,
    });
    // Inactive add-ons aren't offered in quotations.
    const picker = (await P(admin, '/picker')).body.data;
    expect(picker.flatMap((p: any) => p.addons.map((a: any) => a.id))).not.toContain(id);
    expect((await P(admin, `/addons/${id}`, undefined, 'DELETE')).status).toBe(200);
    const support = await staff(['support_staff']);
    expect((await P(support, '')).status).toBe(403);
    expect((await P(support, '/picker')).status).toBe(403);
  });
});
