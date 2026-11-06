import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { businessDate } from '../../src/server/lib/dates';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
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

let seq = 0;
async function paidInvoice(s: S, amountPaid: number) {
  const name = `Zambezi Tours ${++seq}-${Date.now() % 1e6}`;
  const c = await api('/api/v1/admin/clients', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      type: 'business',
      displayName: name,
      email: 'accounts@zambezi.example',
      defaultCurrency: 'USD',
      paymentTermsDays: 14,
      tags: [],
      primaryContact: { name: 'Farai Sibanda', email: 'farai@zambezi.example' },
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
        { description: 'Booking site', quantity: '1', unitPriceMinor: 50_000, discountType: 'none', discountValue: 0 },
      ],
    },
  });
  const invoiceId = d.body.data.id as string;
  await api(`/api/v1/admin/invoices/${invoiceId}/issue`, { cookie: s.cookie, csrf: s.csrf, body: { send: false } });
  const pay = await api(`/api/v1/admin/invoices/${invoiceId}/payments`, {
    cookie: s.cookie,
    csrf: s.csrf,
    body: { amountMinor: amountPaid, method: 'ecocash', receivedOn: businessDate(new Date()), reference: `EC-${seq}` },
  });
  expect(pay.status, JSON.stringify(pay.body)).toBe(201);
  return {
    clientId,
    invoiceId,
    name,
    paymentId: pay.body.data.paymentId as string,
    receipt: pay.body.data.receiptNumber as string,
  };
}
const refund = (s: S, paymentId: string, body: Record<string, unknown>) =>
  api(`/api/v1/admin/payments/${paymentId}/refunds`, { cookie: s.cookie, csrf: s.csrf, body });

describe('payments admin (P4.11)', () => {
  beforeEach(() => seedBase());

  it('lists and filters payments, and shows a payment with its allocations', async () => {
    const s = await session(['admin']);
    const a = await paidInvoice(s, 50_000);
    const b = await paidInvoice(s, 60_000); // 10,000 over → credit

    const byClient = await api(`/api/v1/admin/payments?clientId=${a.clientId}`, { cookie: s.cookie });
    expect(byClient.status).toBe(200);
    expect(byClient.body.data.items).toHaveLength(1);
    expect(byClient.body.data.items[0]).toMatchObject({
      receipt_number: a.receipt,
      provider_key: 'manual',
      method: 'ecocash',
    });
    const byReceipt = await api(`/api/v1/admin/payments?q=${encodeURIComponent(b.receipt)}`, { cookie: s.cookie });
    expect(byReceipt.body.data.items.map((p: any) => p.id)).toEqual([b.paymentId]);
    const invNumber = (await row('SELECT number FROM invoices WHERE id = ?', b.invoiceId)).number as string;
    expect((await api(`/api/v1/admin/payments?q=${invNumber}`, { cookie: s.cookie })).body.data.items[0].id).toBe(
      b.paymentId,
    );
    expect(
      (await api('/api/v1/admin/payments?status=refunded&method=cash', { cookie: s.cookie })).body.data.items.every(
        (p: any) => p.status === 'refunded',
      ),
    ).toBe(true);
    expect(
      (await api('/api/v1/admin/payments?from=2001-01-01&to=2001-01-02', { cookie: s.cookie })).body.data.total,
    ).toBe(0);
    expect((await api('/api/v1/admin/payments?status=lost', { cookie: s.cookie })).status).toBe(422);

    const detail = await api(`/api/v1/admin/payments/${b.paymentId}`, { cookie: s.cookie });
    expect(detail.status).toBe(200);
    expect(detail.body.data.allocations).toHaveLength(1);
    expect(detail.body.data.allocations[0].amount_minor).toBe(50_000);
    expect(detail.body.data.refundable).toBe(60_000);
    expect(detail.body.data.refundSources.accountCredit).toBe(10_000);
    expect((await api('/api/v1/admin/payments/pay_missing', { cookie: s.cookie })).status).toBe(404);
  });

  it('records refunds covered by account credit or a refund credit note, never more than paid or covered', async () => {
    const s = await session(['admin']);
    const p = await paidInvoice(s, 60_000); // 10,000 account credit

    // No credit note, account credit 10,000: refund at most that.
    expect(
      (await refund(s, p.paymentId, { amountMinor: 10_001, reason: 'Overpaid', source: 'account_credit' })).status,
    ).toBe(422);
    const r1 = await refund(s, p.paymentId, {
      amountMinor: 10_000,
      reason: 'Overpaid',
      source: 'account_credit',
      reference: 'EC-R1',
    });
    expect(r1.status, JSON.stringify(r1.body)).toBe(201);
    expect(r1.body.data.status).toBe('partially_refunded');
    expect((await row('SELECT SUM(amount_minor) AS n FROM client_credits WHERE client_id = ?', p.clientId)).n).toBe(0);

    // A refund credit note on the paid invoice covers a further refund.
    const cn = await api(`/api/v1/admin/invoices/${p.invoiceId}/credit-notes`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: {
        reason: 'Project cancelled',
        appliedTo: 'refund',
        lines: [{ description: 'Cancelled work', amountMinor: 50_000 }],
      },
    });
    expect(cn.status, JSON.stringify(cn.body)).toBe(201);
    expect((await refund(s, p.paymentId, { amountMinor: 100, reason: 'x', source: 'credit_note' })).status).toBe(422); // which note?
    expect(
      (
        await refund(s, p.paymentId, {
          amountMinor: 50_001,
          reason: 'Cancelled',
          source: 'credit_note',
          creditNoteId: cn.body.data.id,
        })
      ).status,
    ).toBe(422);
    const r2 = await refund(s, p.paymentId, {
      amountMinor: 50_000,
      reason: 'Cancelled',
      source: 'credit_note',
      creditNoteId: cn.body.data.id,
    });
    expect(r2.status, JSON.stringify(r2.body)).toBe(201);
    expect(r2.body.data.status).toBe('refunded');
    expect((await row('SELECT status FROM payments WHERE id = ?', p.paymentId)).status).toBe('refunded');
    expect((await refund(s, p.paymentId, { amountMinor: 1, reason: 'More', source: 'account_credit' })).status).toBe(
      409,
    );
    expect(
      (
        await row(
          "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'payment.refund_recorded' AND entity_id = ?",
          p.paymentId,
        )
      ).n,
    ).toBe(2);
    const detail = await api(`/api/v1/admin/payments/${p.paymentId}`, { cookie: s.cookie });
    expect(detail.body.data.refunds.map((r: any) => r.credit_note_number)).toEqual([null, cn.body.data.number]);
    expect(detail.body.data.refundable).toBe(0);
  });

  it('never over-refunds under concurrency', async () => {
    const s = await session(['admin']);
    const p = await paidInvoice(s, 80_000); // 30,000 credit
    const body = { amountMinor: 20_000, reason: 'Overpaid', source: 'account_credit' };
    const results = await Promise.all([refund(s, p.paymentId, body), refund(s, p.paymentId, body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await row('SELECT SUM(amount_minor) AS n FROM refunds WHERE payment_id = ?', p.paymentId)).n).toBe(20_000);
    expect((await row('SELECT SUM(amount_minor) AS n FROM client_credits WHERE client_id = ?', p.clientId)).n).toBe(
      10_000,
    );
  });

  it('shows unmatched gateway notifications and enforces permissions', async () => {
    const s = await session(['admin']);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO payment_events (id, provider_key, account_id, event_type, provider_reference, dedupe_hash, payload_redacted)
       VALUES ('pev_unmatched_1', 'paynow', 'ppa_paynow_usd', 'unmatched', 'PN-404', 'dedupe-unmatched-1', '{"status":"Paid","amount":"10.00"}')`,
    ).run();
    const um = await api('/api/v1/admin/payments/unmatched', { cookie: s.cookie });
    expect(um.status).toBe(200);
    expect(um.body.data.items.some((e: any) => e.provider_reference === 'PN-404' && e.account === 'Paynow USD')).toBe(
      true,
    );

    const p = await paidInvoice(s, 60_000);
    const pm = await session(['project_manager']);
    expect((await api('/api/v1/admin/payments', { cookie: pm.cookie })).status).toBe(403);
    expect((await refund(pm, p.paymentId, { amountMinor: 100, reason: 'x', source: 'account_credit' })).status).toBe(
      403,
    );
  });
});
