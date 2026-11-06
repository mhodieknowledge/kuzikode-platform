import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { businessDate } from '../../src/server/lib/dates';
import { api, login, type Session } from '../helpers/api';
import { createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 8);

async function staff() {
  const x = await createStaff(['admin']);
  return login('admin', x.email, x.password);
}

const A = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });
const P = (s: Session, path: string) => api(`/api/v1/portal${path}`, { cookie: s.cookie });

async function client(s: Session, name: string) {
  const res = await A(s, '/clients', {
    type: 'business',
    displayName: name,
    email: `accounts-${u()}@example.com`,
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function invoice(s: Session, clientId: string, opts: { issue?: boolean } = {}) {
  const d = await A(s, '/invoices', {
    clientId,
    currency: 'USD',
    items: [
      { description: 'Website build', quantity: '1', unitPriceMinor: 60_000, discountType: 'none', discountValue: 0 },
      { description: 'Hosting months', quantity: '12', unitPriceMinor: 2_500, discountType: 'none', discountValue: 0 },
    ],
  });
  expect(d.status, JSON.stringify(d.body)).toBe(201);
  const id = d.body.data.id as string;
  if (opts.issue !== false) expect((await A(s, `/invoices/${id}/issue`, { send: false })).status).toBe(200);
  return id;
}

describe('portal invoices & credit notes (P5.4)', () => {
  beforeEach(() => seedBase());

  it('lists issued invoices of the caller’s clients (open first); drafts and other clients are 404 everywhere', async () => {
    const s = await staff();
    const mine = await client(s, 'Mine Ltd');
    const other = await client(s, 'Other Ltd');
    const open = await invoice(s, mine);
    const paid = await invoice(s, mine);
    expect(
      (
        await A(s, `/invoices/${paid}/payments`, {
          amountMinor: 90_000,
          method: 'bank_transfer',
          receivedOn: businessDate(new Date()),
        })
      ).status,
    ).toBe(201);
    const draft = await invoice(s, mine, { issue: false });
    const foreign = await invoice(s, other);
    const user = await createPortalUser([mine], { role: 'billing' });
    const p = await login('portal', user.email, user.password);

    const toPay = await P(p, '/invoices?show=open');
    expect(toPay.body.data.map((i: { id: string }) => i.id)).toEqual([open]);
    const all = await P(p, '/invoices');
    expect(all.body.data.map((i: { id: string }) => i.id)).toEqual([open, paid]);
    expect(all.body.data[0]).toMatchObject({
      status: 'issued',
      totalMinor: 90_000,
      balanceMinor: 90_000,
      overdue: false,
    });
    expect(all.body.data[1]).toMatchObject({ status: 'paid', balanceMinor: 0 });

    for (const id of [draft, foreign, 'inv_nope']) {
      expect((await P(p, `/invoices/${id}`)).status).toBe(404);
      expect((await P(p, `/invoices/${id}/pdf`)).status).toBe(404);
    }
  });

  it('shows one invoice with payments, credit notes and payment instructions; PDFs download', async () => {
    const s = await staff();
    const c = await client(s, 'Detail Ltd');
    const id = await invoice(s, c);
    const saved = await api('/api/v1/admin/settings/sections/documents', {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: { 'documents.bank_details': 'CBZ Bank\nAccount 0123456789' },
    });
    expect(saved.status).toBe(200);
    expect(
      (
        await A(s, `/invoices/${id}/payments`, {
          amountMinor: 20_000,
          method: 'bank_transfer',
          receivedOn: businessDate(new Date()),
        })
      ).status,
    ).toBe(201);
    const items = (await A(s, `/invoices/${id}`)).body.data.items as { id: string }[];
    const cn = await A(s, `/invoices/${id}/credit-notes`, {
      reason: 'Hosting starts later',
      appliedTo: 'invoice',
      lines: [{ invoiceItemId: items[1]!.id, quantity: '4' }],
    });
    expect(cn.status, JSON.stringify(cn.body)).toBe(201);

    const user = await createPortalUser([c]);
    const p = await login('portal', user.email, user.password);
    const d = await P(p, `/invoices/${id}`);
    expect(d.status).toBe(200);
    expect(d.body.data.invoice).toMatchObject({
      totalMinor: 90_000,
      paidMinor: 20_000,
      creditedMinor: 10_000,
      balanceMinor: 60_000,
      status: 'partially_paid',
    });
    expect(d.body.data.payments).toEqual([expect.objectContaining({ appliedMinor: 20_000 })]);
    expect(d.body.data.creditNotes).toEqual([
      expect.objectContaining({ totalMinor: 10_000, reason: 'Hosting starts later', appliedTo: 'invoice' }),
    ]);
    expect(d.body.data.payment.bankDetails).toBe('CBZ Bank\nAccount 0123456789');

    const pdf = await P(p, `/invoices/${id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('content-disposition')).toMatch(/^attachment/);
    expect((await P(p, `/invoices/${id}/pdf?inline=1`)).headers.get('content-disposition')).toMatch(/^inline/);

    const credits = await P(p, '/credit-notes');
    expect(credits.body.data).toHaveLength(1);
    const cnId = credits.body.data[0].id as string;
    const cnPdf = await P(p, `/credit-notes/${cnId}/pdf`);
    expect(cnPdf.status).toBe(200);
    expect(cnPdf.headers.get('content-type')).toBe('application/pdf');

    // Another client's portal user can't reach either document.
    const other = await createPortalUser([await client(s, 'Nosy Ltd')]);
    const o = await login('portal', other.email, other.password);
    expect((await P(o, `/credit-notes/${cnId}/pdf`)).status).toBe(404);
    expect((await P(o, '/credit-notes')).body.data).toEqual([]);
  });

  it('marks an invoice past its due date as overdue before the nightly job runs', async () => {
    const s = await staff();
    const c = await client(s, 'Late Ltd');
    const id = await invoice(s, c);
    await env.DB.prepare("UPDATE invoices SET due_date = '2000-01-31' WHERE id = ?").bind(id).run();
    const user = await createPortalUser([c]);
    const p = await login('portal', user.email, user.password);
    expect((await P(p, '/invoices')).body.data[0]).toMatchObject({ status: 'issued', overdue: true });
    expect((await P(p, `/invoices/${id}`)).body.data.overdue).toBe(true);
  });

  it('"member" contacts have no invoices area at all', async () => {
    const s = await staff();
    const c = await client(s, 'Member Ltd');
    const id = await invoice(s, c);
    const member = await createPortalUser([c], { role: 'member' });
    const p = await login('portal', member.email, member.password);
    expect((await P(p, '/invoices')).body.data).toEqual([]);
    expect((await P(p, `/invoices/${id}`)).status).toBe(404);
    expect((await P(p, `/invoices/${id}/pdf`)).status).toBe(404);
  });
});
