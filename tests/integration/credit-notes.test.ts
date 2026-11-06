import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { businessDate } from '../../src/server/lib/dates';
import { ORIGIN, api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { pdfText } from '../helpers/pdf-text';
import { seedBase } from '../helpers/seed';

async function session(roles: string[]) {
  const u = await createStaff(roles);
  return login('admin', u.email, u.password);
}
type S = Awaited<ReturnType<typeof session>>;
const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();

async function issuedInvoice(s: S) {
  const c = await api('/api/v1/admin/clients', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      type: 'business',
      displayName: 'Mopane Lodge',
      email: 'accounts@mopane.example',
      defaultCurrency: 'USD',
      paymentTermsDays: 14,
      tags: [],
      primaryContact: { name: 'Nyasha Dube', email: 'nyasha@mopane.example' },
    },
  });
  const clientId = c.body.data.id as string;
  const d = await api('/api/v1/admin/invoices', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      clientId,
      currency: 'USD',
      items: [
        { description: 'Website build', quantity: '1', unitPriceMinor: 60_000, discountType: 'none', discountValue: 0 },
        {
          description: 'Hosting months',
          quantity: '12',
          unitPriceMinor: 2_500,
          discountType: 'none',
          discountValue: 0,
        },
      ],
    },
  });
  const id = d.body.data.id as string;
  expect(
    (await api(`/api/v1/admin/invoices/${id}/issue`, { cookie: s.cookie, csrf: s.csrf, body: { send: false } })).status,
  ).toBe(200);
  const items = (await api(`/api/v1/admin/invoices/${id}`, { cookie: s.cookie })).body.data.items as { id: string }[];
  return { id, clientId, build: items[0]!.id, hosting: items[1]!.id };
}
const credit = (s: S, id: string, body: Record<string, unknown>) =>
  api(`/api/v1/admin/invoices/${id}/credit-notes`, { cookie: s.cookie, csrf: s.csrf, body });
const pay = (s: S, id: string, amountMinor: number) =>
  api(`/api/v1/admin/invoices/${id}/payments`, {
    cookie: s.cookie,
    csrf: s.csrf,
    body: { amountMinor, method: 'cash', receivedOn: businessDate(new Date()) },
  });
const inv = (id: string) => row('SELECT * FROM invoices WHERE id = ?', id);

describe('credit notes (P4.10)', () => {
  beforeEach(() => seedBase());

  it('reduces the invoice balance with a numbered credit note; a fully credited invoice is settled', async () => {
    const s = await session(['admin']);
    const { id, build, hosting } = await issuedInvoice(s); // 60,000 + 30,000 = 90,000

    const first = await credit(s, id, {
      reason: 'Hosting starts later',
      appliedTo: 'invoice',
      lines: [{ invoiceItemId: hosting, quantity: '4' }],
    });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.data).toMatchObject({ totalMinor: 10_000, status: 'partially_paid' });
    expect(first.body.data.number).toMatch(/^CN-\d{4}-\d{4}$/);
    expect(await inv(id)).toMatchObject({
      amount_credited_minor: 10_000,
      balance_minor: 80_000,
      status: 'partially_paid',
    });

    // Can't credit more hosting than is left (8 months), nor more than the balance.
    expect(
      (
        await credit(s, id, {
          reason: 'Too many',
          appliedTo: 'invoice',
          lines: [{ invoiceItemId: hosting, quantity: '9' }],
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await credit(s, id, {
          reason: 'Too much',
          appliedTo: 'invoice',
          lines: [{ description: 'Goodwill', amountMinor: 80_001 }],
        })
      ).status,
    ).toBe(422);
    // Nothing paid yet: nothing to give back as credit or refund.
    expect(
      (
        await credit(s, id, {
          reason: 'Refund',
          appliedTo: 'refund',
          lines: [{ description: 'Goodwill', amountMinor: 100 }],
        })
      ).status,
    ).toBe(422);

    const rest = await credit(s, id, {
      reason: 'Project cancelled',
      appliedTo: 'invoice',
      lines: [
        { invoiceItemId: build, quantity: '1' },
        { invoiceItemId: hosting, quantity: '8' },
      ],
    });
    expect(rest.status, JSON.stringify(rest.body)).toBe(201);
    const n = (x: string) => Number(x.split('-').at(-1));
    expect(n(rest.body.data.number)).toBe(n(first.body.data.number) + 1);
    expect(await inv(id)).toMatchObject({ amount_credited_minor: 90_000, balance_minor: 0, status: 'paid' });
    expect(
      (await row("SELECT COUNT(*) AS n FROM invoice_status_history WHERE invoice_id = ? AND to_status = 'paid'", id)).n,
    ).toBe(1);
    const items = await env.DB.prepare(
      'SELECT quantity_milli, line_total_minor FROM credit_note_items WHERE credit_note_id = ? ORDER BY id',
    )
      .bind(rest.body.data.id)
      .all<any>();
    expect(items.results).toEqual([
      { quantity_milli: 1000, line_total_minor: 60_000 },
      { quantity_milli: 8000, line_total_minor: 20_000 },
    ]);

    // Issued credit notes are permanent; their PDF renders with both numbers.
    await expect(
      env.DB.prepare('DELETE FROM credit_notes WHERE id = ?').bind(rest.body.data.id).run(),
    ).rejects.toThrow();
    const pdf = await exports.default.fetch(`${ORIGIN}/api/v1/admin/documents/credit-notes/${rest.body.data.id}/pdf`, {
      headers: { cookie: s.cookie },
    });
    const text = await pdfText(new Uint8Array(await pdf.arrayBuffer()));
    expect(text).toContain(rest.body.data.number);
    expect(text).toContain((await inv(id)).number);
    expect(
      (await row("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'credit_note.issued' AND entity_id = ?", id)).n,
    ).toBe(2);
  });

  it('gives paid money back as account credit or a refund record, limited to what was paid', async () => {
    const s = await session(['admin']);
    const { id, clientId, hosting } = await issuedInvoice(s);
    await pay(s, id, 90_000);
    expect((await inv(id)).status).toBe('paid');

    const cc = await credit(s, id, {
      reason: 'Hosting not needed',
      appliedTo: 'client_credit',
      lines: [{ invoiceItemId: hosting, quantity: '12' }],
    });
    expect(cc.status, JSON.stringify(cc.body)).toBe(201);
    expect(await inv(id)).toMatchObject({ status: 'paid', balance_minor: 0, amount_credited_minor: 0 });
    expect(
      (
        await row(
          "SELECT SUM(amount_minor) AS n FROM client_credits WHERE client_id = ? AND source_type = 'credit_note'",
          clientId,
        )
      ).n,
    ).toBe(30_000);

    const rf = await credit(s, id, {
      reason: 'Partial refund agreed',
      appliedTo: 'refund',
      lines: [{ description: 'Discount agreed after delivery', amountMinor: 5_000 }],
    });
    expect(rf.status).toBe(201);
    expect(await row('SELECT applied_to, total_minor FROM credit_notes WHERE id = ?', rf.body.data.id)).toEqual({
      applied_to: 'refund',
      total_minor: 5_000,
    });
    // 90,000 paid, 35,000 already given back: at most 55,000 more.
    expect(
      (
        await credit(s, id, {
          reason: 'Too much',
          appliedTo: 'refund',
          lines: [{ description: 'More', amountMinor: 55_001 }],
        })
      ).status,
    ).toBe(422);
  });

  it('serialises concurrent credit notes on one invoice and requires the permission', async () => {
    const s = await session(['admin']);
    const { id } = await issuedInvoice(s);
    const body = {
      reason: 'Goodwill',
      appliedTo: 'invoice',
      lines: [{ description: 'Goodwill', amountMinor: 50_000 }],
    };
    const results = await Promise.all([credit(s, id, body), credit(s, id, body)]);
    const statuses = results.map((r) => r.status).sort();
    // Each fits alone (50,000 ≤ 90,000) but not both: at most one wins; the other is refused or re-checked.
    expect(statuses[0]).toBe(201);
    expect([201, 409, 422]).toContain(statuses[1]);
    const i = await inv(id);
    expect(i.amount_credited_minor + i.balance_minor).toBe(90_000);
    expect(i.balance_minor).toBeGreaterThanOrEqual(0);

    const pm = await session(['project_manager']);
    expect((await credit(pm, id, body)).status).toBe(403);
    const draft = await api('/api/v1/admin/invoices', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: {
        clientId: i.client_id,
        currency: 'USD',
        items: [{ description: 'X', quantity: '1', unitPriceMinor: 100 }],
      },
    });
    expect((await credit(s, draft.body.data.id, body)).status).toBe(409);
  });
});
