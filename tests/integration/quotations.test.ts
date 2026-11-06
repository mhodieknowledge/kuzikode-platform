import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { expireQuotations, getPublicQuotation } from '../../src/server/modules/quotations';
import { computeDocument } from '../../src/shared/pricing';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

async function session(roles: string[]) {
  const u = await createStaff(roles);
  return login('admin', u.email, u.password);
}
type S = Awaited<ReturnType<typeof session>>;

async function newClient(s: S, email: string | null = 'accounts@baobab.example') {
  const res = await api('/api/v1/admin/clients', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      type: 'business',
      displayName: 'Baobab Foods',
      ...(email ? { email } : {}),
      defaultCurrency: 'USD',
      paymentTermsDays: 7,
      tags: [],
      primaryContact: email ? { name: 'Tariro Banda', email: 'tariro@baobab.example' } : undefined,
    },
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const lines = [
  { description: 'Website design', quantity: '1', unitPriceMinor: 80_000, discountType: 'none', discountValue: 0 },
  { description: 'Content pages', quantity: '6', unitPriceMinor: 4_500, discountType: 'percent', discountValue: 1000 },
  {
    description: 'Hosting (12 months)',
    quantity: '12',
    unitPriceMinor: 1_250,
    discountType: 'amount',
    discountValue: 500,
    taxRateId: 'tax_vat',
  },
];
const body = (clientId: string, over: Record<string, unknown> = {}) => ({
  clientId,
  title: 'New company website',
  currency: 'USD',
  discountType: 'percent',
  discountValue: 500,
  items: lines,
  ...over,
});

async function createDraft(s: S, clientId: string, over: Record<string, unknown> = {}) {
  const res = await api('/api/v1/admin/quotations', { cookie: s.cookie, csrf: s.csrf, body: body(clientId, over) });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}
const send = (s: S, id: string) =>
  api(`/api/v1/admin/quotations/${id}/send`, { cookie: s.cookie, csrf: s.csrf, body: {} });
const tokenOf = (link: string) => link.split('/q/')[1]!;
const respond = (token: string, b: Record<string, unknown>) =>
  api(`/api/v1/public/quotations/${token}/respond`, { body: b });

describe('quotations (P4.7)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare("UPDATE tax_rates SET active = 1 WHERE id = 'tax_vat'").run();
  });

  it('prices lines with the shared engine, sends with a gap-free number, snapshot and queued email; sent ones are read-only', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const id = await createDraft(s, clientId);
    const expected = computeDocument({
      lines: [
        { quantityMilli: 1000, unitPriceMinor: 80_000 },
        { quantityMilli: 6000, unitPriceMinor: 4_500, discount: { type: 'percent', value: 1000 } },
        {
          quantityMilli: 12_000,
          unitPriceMinor: 1_250,
          discount: { type: 'amount', value: 500 },
          taxRateBp: 1550,
          taxInclusive: false,
        },
      ],
      discount: { type: 'percent', value: 500 },
    });
    const draft = await api(`/api/v1/admin/quotations/${id}`, { cookie: s.cookie });
    expect(draft.body.data.quotation).toMatchObject({
      status: 'draft',
      number: null,
      subtotal_minor: expected.subtotalMinor,
      discount_minor: expected.discountMinor,
      tax_minor: expected.taxMinor,
      total_minor: expected.totalMinor,
    });
    expect(draft.body.data.items.map((i: any) => i.line_total_minor)).toEqual(expected.lines.map((l) => l.totalMinor));
    expect(draft.body.data.publicLink).toBeNull();

    // Editing a draft replaces its lines.
    const upd = await api(`/api/v1/admin/quotations/${id}`, {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: body(clientId, { items: lines.slice(0, 2), discountType: 'none', discountValue: 0 }),
    });
    expect(upd.status).toBe(200);
    expect((await api(`/api/v1/admin/quotations/${id}`, { cookie: s.cookie })).body.data.items).toHaveLength(2);

    const sent = await send(s, id);
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.data.number).toMatch(/^QUO-\d{4}-\d{4}$/);
    const id2 = await createDraft(s, clientId);
    const sent2 = await send(s, id2);
    const n = (x: string) => Number(x.split('-').at(-1));
    expect(n(sent2.body.data.number)).toBe(n(sent.body.data.number) + 1);

    const row = await env.DB.prepare('SELECT * FROM quotations WHERE id = ?').bind(id).first<any>();
    expect(row.status).toBe('sent');
    expect(row.valid_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.parse(row.client_snapshot)).toMatchObject({ name: 'Baobab Foods', contact: { name: 'Tariro Banda' } });
    const job = await env.DB.prepare("SELECT payload FROM outbox WHERE type = 'email.send' AND payload LIKE ?")
      .bind(`%${id}%`)
      .first<{ payload: string }>();
    expect(JSON.parse(job!.payload)).toMatchObject({ template: 'quotation_sent', to: 'tariro@baobab.example' });

    const edit = await api(`/api/v1/admin/quotations/${id}`, {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: body(clientId),
    });
    expect(edit.status).toBe(409);
    expect(
      (await api(`/api/v1/admin/quotations/${id}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf })).status,
    ).toBe(409);
    // Snapshot stays frozen after the client changes.
    await env.DB.prepare("UPDATE clients SET display_name = 'Renamed' WHERE id = ?").bind(clientId).run();
    await send(s, id); // resend
    const again = await env.DB.prepare('SELECT client_snapshot, number FROM quotations WHERE id = ?')
      .bind(id)
      .first<any>();
    expect(JSON.parse(again.client_snapshot).name).toBe('Baobab Foods');
    expect(again.number).toBe(sent.body.data.number);
  });

  it('public link: first view marks viewed; accept needs name + confirmation and records IP; convert twice (and concurrently) → one invoice', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const id = await createDraft(s, clientId);
    await send(s, id);
    const link = (await api(`/api/v1/admin/quotations/${id}`, { cookie: s.cookie })).body.data.publicLink as string;
    const token = tokenOf(link);
    const view = await getPublicQuotation(createContext({ env }), token);
    expect(view?.open).toBe(true);
    expect(view?.quotation.status).toBe('viewed');
    expect(await getPublicQuotation(createContext({ env }), 'x'.repeat(43))).toBeNull();

    // Converting before acceptance is refused.
    expect(
      (await api(`/api/v1/admin/quotations/${id}/convert`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(409);
    const bad = await respond(token, { decision: 'accept', name: '' });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['agree', 'name']);
    const okRes = await respond(token, { decision: 'accept', name: 'Tariro Banda', agree: true });
    expect(okRes.status, JSON.stringify(okRes.body)).toBe(200);
    expect((await respond(token, { decision: 'reject' })).status).toBe(409);
    const row = await env.DB.prepare('SELECT status, accepted_by_name, accepted_ip FROM quotations WHERE id = ?')
      .bind(id)
      .first<any>();
    expect(row).toMatchObject({ status: 'accepted', accepted_by_name: 'Tariro Banda' });
    expect(row.accepted_ip).toBeTruthy();
    const notified = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM notifications WHERE type = 'quotation.accepted' AND entity_id = ?",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(notified!.n).toBeGreaterThan(0);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        api(`/api/v1/admin/quotations/${id}/convert`, { cookie: s.cookie, csrf: s.csrf, body: {} }),
      ),
    );
    const ids = new Set(results.map((r) => r.body.data.invoiceId));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const repeat = await api(`/api/v1/admin/quotations/${id}/convert`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    expect(repeat.status).toBe(200);
    expect(repeat.body.data.invoiceId).toBe([...ids][0]);
    const inv = await env.DB.prepare('SELECT * FROM invoices WHERE source_quotation_id = ?').bind(id).first<any>();
    const q = await env.DB.prepare('SELECT total_minor FROM quotations WHERE id = ?').bind(id).first<any>();
    expect(inv).toMatchObject({ status: 'draft', number: null, total_minor: q.total_minor, payment_terms_days: 7 });
    const items = await env.DB.prepare('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id = ?')
      .bind(inv.id)
      .first<{ n: number }>();
    expect(items!.n).toBe(3);
    // A converted quotation cannot be voided.
    expect(
      (
        await api(`/api/v1/admin/quotations/${id}/void`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { reason: 'Mistake' },
        })
      ).status,
    ).toBe(409);
  });

  it('revise keeps the old version read-only and numbers the new one -v2; reject, expire, void and draft delete', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const id = await createDraft(s, clientId);
    const first = await send(s, id);
    const rev = await api(`/api/v1/admin/quotations/${id}/revise`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    expect(rev.status).toBe(201);
    const v2 = rev.body.data.id as string;
    expect(
      (await api(`/api/v1/admin/quotations/${id}/revise`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(409);
    expect((await send(s, id)).status).toBe(409); // superseded versions can't be re-sent
    const sentV2 = await send(s, v2);
    expect(sentV2.body.data.number).toBe(`${first.body.data.number}-v2`);
    const detail = await api(`/api/v1/admin/quotations/${v2}`, { cookie: s.cookie });
    expect(detail.body.data.versions.map((v: any) => v.version)).toEqual([1, 2]);

    // The old link now points to the newer version and can't be accepted.
    const oldToken = tokenOf((await api(`/api/v1/admin/quotations/${id}`, { cookie: s.cookie })).body.data.publicLink);
    const old = await getPublicQuotation(createContext({ env }), oldToken);
    expect(old?.open).toBe(false);
    expect(old?.newerVersionLink).toContain('/q/');
    expect((await respond(oldToken, { decision: 'accept', name: 'Tariro Banda', agree: true })).status).toBe(409);

    const v2Token = tokenOf(detail.body.data.publicLink);
    const rej = await respond(v2Token, { decision: 'reject', reason: 'Over budget this quarter.' });
    expect(rej.status).toBe(200);
    expect(
      await env.DB.prepare('SELECT status, rejection_reason FROM quotations WHERE id = ?').bind(v2).first<any>(),
    ).toEqual({ status: 'rejected', rejection_reason: 'Over budget this quarter.' });

    // Expiry cron: a sent quotation past its date becomes expired, once.
    const id3 = await createDraft(s, clientId, { validUntil: '2026-01-31' });
    await send(s, id3);
    await env.DB.prepare("UPDATE quotations SET valid_until = '2026-01-31' WHERE id = ?").bind(id3).run();
    const ctx = createContext({ env, now: () => new Date('2026-02-01T08:00:00Z') });
    expect(await expireQuotations(ctx)).toBeGreaterThanOrEqual(1);
    expect((await env.DB.prepare('SELECT status FROM quotations WHERE id = ?').bind(id3).first<any>()).status).toBe(
      'expired',
    );
    const vd = await api(`/api/v1/admin/quotations/${id3}/void`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { reason: 'Client went with another supplier' },
    });
    expect(vd.status).toBe(200);
    const audit = await env.DB.prepare("SELECT 1 FROM audit_logs WHERE action = 'quotation.voided' AND entity_id = ?")
      .bind(id3)
      .first();
    expect(audit).not.toBeNull();

    const draft = await createDraft(s, clientId);
    expect(
      (await api(`/api/v1/admin/quotations/${draft}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf })).status,
    ).toBe(200);
    expect(await env.DB.prepare('SELECT 1 FROM quotations WHERE id = ?').bind(draft).first()).toBeNull();
  });

  it('package lines keep their price after the catalogue changes; validation and permissions', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const pkg = (await env.DB.prepare(
      "SELECT id, service_id, price_minor FROM service_packages WHERE price_minor IS NOT NULL AND currency = 'USD' LIMIT 1",
    ).first<any>())!;
    const id = await createDraft(s, clientId, {
      discountType: 'none',
      discountValue: 0,
      items: [
        {
          description: 'Package',
          quantity: '1',
          unitPriceMinor: pkg.price_minor,
          packageId: pkg.id,
          serviceId: pkg.service_id,
          discountType: 'none',
          discountValue: 0,
        },
      ],
    });
    await env.DB.prepare('UPDATE service_packages SET price_minor = price_minor + 10000 WHERE id = ?')
      .bind(pkg.id)
      .run();
    const item = await env.DB.prepare('SELECT unit_price_minor FROM quotation_items WHERE quotation_id = ?')
      .bind(id)
      .first<any>();
    expect(item.unit_price_minor).toBe(pkg.price_minor);

    const bad = await api('/api/v1/admin/quotations', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: body(clientId, { items: [{ ...lines[0], quantity: '0.0001' }], currency: 'XXX' }),
    });
    expect(bad.status).toBe(422);
    const noEmailClient = await newClient(s, null);
    const draft = await createDraft(s, noEmailClient);
    const noEmail = await send(s, draft);
    expect(noEmail.status).toBe(422);
    expect(noEmail.body.error.fields.contactId).toBeDefined();

    const pm = await session(['project_manager']);
    expect((await api('/api/v1/admin/quotations', { cookie: pm.cookie })).status).toBe(200);
    expect(
      (await api('/api/v1/admin/quotations', { cookie: pm.cookie, csrf: pm.csrf, body: body(clientId) })).status,
    ).toBe(403);
  });
});
