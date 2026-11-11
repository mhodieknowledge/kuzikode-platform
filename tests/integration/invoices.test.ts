import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { processOutbox } from '../../src/server/jobs/consumer';
import { markOverdue, sendReminders } from '../../src/server/modules/invoices';
import { businessDate, addDays } from '../../src/server/lib/dates';
import { ORIGIN, api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { isPdf, pdfText } from '../helpers/pdf-text';
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
const all = async (sql: string, ...p: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...p)
      .all<any>()
  ).results;

async function newClient(s: S, name = 'Baobab Foods') {
  const res = await api('/api/v1/admin/clients', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      type: 'business',
      displayName: name,
      email: 'accounts@baobab.example',
      defaultCurrency: 'USD',
      paymentTermsDays: 7,
      tags: [],
      primaryContact: { name: 'Tariro Banda', email: 'tariro@baobab.example' },
    },
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const lines = [
  { description: 'Website build', quantity: '1', unitPriceMinor: 80_000, discountType: 'none', discountValue: 0 },
  { description: 'Content pages', quantity: '4', unitPriceMinor: 5_000, discountType: 'none', discountValue: 0 },
];

async function draft(s: S, clientId: string, over: Record<string, unknown> = {}) {
  const res = await api('/api/v1/admin/invoices', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: { clientId, currency: 'USD', items: lines, ...over },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}
const call = (s: S, id: string, path: string, body: unknown = {}) =>
  api(`/api/v1/admin/invoices/${id}${path}`, { cookie: s.cookie, csrf: s.csrf, body });
const issue = (s: S, id: string, send = true) => call(s, id, '/issue', { send });
const pay = (s: S, id: string, amountMinor: number, over: Record<string, unknown> = {}) =>
  call(s, id, '/payments', { amountMinor, method: 'bank_transfer', receivedOn: businessDate(new Date()), ...over });
const inv = (id: string) => row('SELECT * FROM invoices WHERE id = ?', id);
const sysCtx = (now = new Date()) => createContext({ env, now: () => now, actor: { type: 'system', userId: null } });

describe('invoices (P4.9)', () => {
  beforeEach(() => seedBase());

  it('issues a draft with number, dates, frozen snapshot, token, history, audit, PDF and email jobs', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const id = await draft(s, clientId);
    const d = await inv(id);
    expect(d).toMatchObject({ status: 'draft', number: null, total_minor: 100_000, balance_minor: 100_000 });
    expect(d.payment_terms_days).toBe(7); // from the client

    // Drafts can be edited; issued invoices cannot.
    const upd = await api(`/api/v1/admin/invoices/${id}`, {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: { clientId, currency: 'USD', items: lines.slice(0, 1) },
    });
    expect(upd.status).toBe(200);
    expect((await inv(id)).total_minor).toBe(80_000);

    const res = await issue(s, id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.number).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(res.body.data.link).toMatch(/\/i\/[A-Za-z0-9_-]+$/);
    const i = await inv(id);
    const today = businessDate(new Date());
    expect(i).toMatchObject({
      status: 'issued',
      issue_date: today,
      due_date: addDays(today, 7),
      balance_minor: 80_000,
    });
    expect(JSON.parse(i.client_snapshot)).toMatchObject({ name: 'Baobab Foods', contact: { name: 'Tariro Banda' } });
    expect(i.public_token_hash).toBeTruthy();

    // Snapshot stays frozen after the client record changes.
    await env.DB.prepare("UPDATE clients SET display_name = 'Renamed Ltd' WHERE id = ?").bind(clientId).run();
    expect(JSON.parse((await inv(id)).client_snapshot).name).toBe('Baobab Foods');

    // Immutable lines, second issue refused, edit refused.
    await expect(
      env.DB.prepare("UPDATE invoice_items SET description = 'x' WHERE invoice_id = ?").bind(id).run(),
    ).rejects.toThrow(/immutable/);
    expect((await issue(s, id)).status).toBe(409);
    expect(
      (
        await api(`/api/v1/admin/invoices/${id}`, {
          method: 'PUT',
          cookie: s.cookie,
          csrf: s.csrf,
          body: { clientId, currency: 'USD', items: lines },
        })
      ).status,
    ).toBe(409);

    const jobs = await all('SELECT type, payload FROM outbox WHERE idempotency_key LIKE ?', `%${id}%`);
    expect(jobs.map((j: any) => j.type).sort()).toEqual(['email.send', 'pdf.generate']);
    const email = JSON.parse(jobs.find((j: any) => j.type === 'email.send').payload);
    expect(email).toMatchObject({ template: 'invoice_issued', to: 'tariro@baobab.example' });
    expect(email.data.link).toContain('/i/');
    const history = await all('SELECT from_status, to_status FROM invoice_status_history WHERE invoice_id = ?', id);
    expect(history).toEqual([
      { from_status: null, to_status: 'draft' },
      { from_status: 'draft', to_status: 'issued' },
    ]);
    expect(
      (await row("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'invoice.issued' AND entity_id = ?", id)).n,
    ).toBe(1);

    // The email job renders with the number filled in at send time.
    const job = await row(
      "SELECT id FROM outbox WHERE type = 'email.send' AND idempotency_key = ?",
      `email:invoice_issued:${id}`,
    );
    expect(await processOutbox(sysCtx(), job.id)).toEqual({ outcome: 'done' });
    const log = await row('SELECT subject FROM email_logs WHERE outbox_id = ?', job.id);
    expect(log.subject).toContain(res.body.data.number);

    // Public link: page and PDF; drafts and bad tokens are not public.
    const token = (res.body.data.link as string).split('/i/')[1]!;
    // (The /i/ page itself is covered by the e2e suite; this worker stubs Astro pages.)
    expect((await exports.default.fetch(`${ORIGIN}/api/v1/public/invoices/${'x'.repeat(43)}/pdf`)).status).toBe(404);
    const pdf = await exports.default.fetch(`${ORIGIN}/api/v1/public/invoices/${token}/pdf`);
    expect(pdf.status).toBe(200);
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    expect(isPdf(bytes)).toBe(true);
    expect(await pdfText(bytes)).toContain(res.body.data.number);
  });

  it('gives 20 concurrently issued invoices 20 unique, sequential numbers; a double issue moves the sequence once', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) ids.push(await draft(s, clientId));
    const results = await Promise.all(ids.map((id) => issue(s, id, false)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const seqs = results.map((r) => Number((r.body.data.number as string).split('-').at(-1))).sort((a, b) => a - b);
    expect(new Set(seqs).size).toBe(20);
    expect(seqs.at(-1)! - seqs[0]!).toBe(19);

    const extra = await draft(s, clientId);
    const both = await Promise.all([issue(s, extra, false), issue(s, extra, false)]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    const next = await draft(s, clientId);
    const n = Number(((await issue(s, next, false)).body.data.number as string).split('-').at(-1));
    expect(n).toBe(seqs.at(-1)! + 2); // extra took +1, next +2: no gap from the refused issue
  });

  it('applies partial, exact and over payments; overpayment becomes client credit that can pay another invoice', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const a = await draft(s, clientId);
    await issue(s, a);

    const p1 = await pay(s, a, 30_000, { reference: 'BANK-001' });
    expect(p1.status, JSON.stringify(p1.body)).toBe(201);
    expect(p1.body.data).toMatchObject({ appliedMinor: 30_000, creditMinor: 0, status: 'partially_paid' });
    expect(p1.body.data.receiptNumber).toMatch(/^RCT-\d{4}-\d{5}$/);
    expect(await inv(a)).toMatchObject({ amount_paid_minor: 30_000, balance_minor: 70_000, status: 'partially_paid' });

    const p2 = await pay(s, a, 100_000, { method: 'cash' });
    expect(p2.body.data).toMatchObject({ appliedMinor: 70_000, creditMinor: 30_000, status: 'paid' });
    expect(await inv(a)).toMatchObject({ amount_paid_minor: 100_000, balance_minor: 0, status: 'paid' });
    const credit = await all('SELECT amount_minor, source_type FROM client_credits WHERE client_id = ?', clientId);
    expect(credit).toEqual([{ amount_minor: 30_000, source_type: 'overpayment' }]);
    expect((await row('SELECT amount_minor FROM payments WHERE id = ?', p2.body.data.paymentId)).amount_minor).toBe(
      100_000,
    );
    expect((await pay(s, a, 1_000)).status).toBe(409);
    expect((await row('SELECT COUNT(*) AS n FROM payment_allocations WHERE invoice_id = ?', a)).n).toBe(2);

    // Receipt email resolves the overpayment credit; the receipt PDF renders.
    const job = await row(
      'SELECT id FROM outbox WHERE idempotency_key = ?',
      `email:payment_receipt:${p2.body.data.paymentId}`,
    );
    await processOutbox(sysCtx(), job.id);
    const log = await row('SELECT html FROM email_logs WHERE outbox_id = ?', job.id);
    expect(log.html).toContain('Held as account credit');
    const receipt = await exports.default.fetch(
      `${ORIGIN}/api/v1/admin/documents/receipts/${p2.body.data.paymentId}/pdf`,
      { headers: { cookie: s.cookie } },
    );
    expect(await pdfText(new Uint8Array(await receipt.arrayBuffer()))).toContain(p2.body.data.receiptNumber);

    // Apply the credit to a second invoice: limited by the credit available and by the balance.
    const b = await draft(s, clientId, { items: [lines[1]] }); // 20,000
    await issue(s, b);
    expect((await call(s, b, '/apply-credit', { amountMinor: 30_001 })).status).toBe(422);
    const ap = await call(s, b, '/apply-credit', { amountMinor: 20_000 });
    expect(ap.status, JSON.stringify(ap.body)).toBe(200);
    expect(ap.body.data.status).toBe('paid');
    expect(await inv(b)).toMatchObject({ amount_credited_minor: 20_000, balance_minor: 0, status: 'paid' });
    expect((await row('SELECT SUM(amount_minor) AS n FROM client_credits WHERE client_id = ?', clientId)).n).toBe(
      10_000,
    );

    const detail = await api(`/api/v1/admin/invoices/${b}`, { cookie: s.cookie });
    expect(detail.body.data.creditsApplied).toHaveLength(1);
    expect(detail.body.data.creditAvailable).toBe(10_000);
  });

  it('keeps the balance right under concurrent payments', async () => {
    const s = await session(['admin']);
    const id = await draft(s, await newClient(s));
    await issue(s, id, false);
    const results = await Promise.all(Array.from({ length: 4 }, () => pay(s, id, 25_000)));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    expect(await inv(id)).toMatchObject({ amount_paid_minor: 100_000, balance_minor: 0, status: 'paid' });
    const receipts = await all(
      'SELECT receipt_number FROM payments p JOIN payment_allocations a ON a.payment_id = p.id WHERE a.invoice_id = ?',
      id,
    );
    expect(new Set(receipts.map((r: any) => r.receipt_number)).size).toBe(4);
  });

  it('voids only without money applied, with a reason, and deletes unissued drafts', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const a = await draft(s, clientId);
    expect((await call(s, a, '/void', { reason: 'Duplicate' })).status).toBe(409); // drafts are deleted instead
    await issue(s, a, false);
    expect((await call(s, a, '/void', { reason: '' })).status).toBe(422);
    expect((await call(s, a, '/void', { reason: 'Raised in error' })).status).toBe(200);
    expect(await inv(a)).toMatchObject({ status: 'void', void_reason: 'Raised in error' });
    expect((await pay(s, a, 100)).status).toBe(409);

    const b = await draft(s, clientId);
    await issue(s, b, false);
    await pay(s, b, 100);
    expect((await call(s, b, '/void', { reason: 'Changed scope' })).status).toBe(409);

    const c = await draft(s, clientId);
    expect(
      (await api(`/api/v1/admin/invoices/${c}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf })).status,
    ).toBe(200);
    expect(await inv(c)).toBeNull();
    expect(
      (await api(`/api/v1/admin/invoices/${b}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf })).status,
    ).toBe(409);
  });

  it('marks overdue invoices nightly and sends each scheduled reminder once', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const a = await draft(s, clientId);
    await issue(s, a, false);
    const paid = await draft(s, clientId);
    await issue(s, paid, false);
    await pay(s, paid, 100_000);
    const due = (await inv(a)).due_date as string;

    const kindsOf = async (id: string) =>
      (await all('SELECT kind FROM invoice_reminders WHERE invoice_id = ? ORDER BY sent_at', id)).map(
        (k: any) => k.kind,
      );

    // Three days before due: the "before_3" reminder, once (other tests' invoices share this database).
    const before = new Date(`${addDays(due, -3)}T08:00:00Z`);
    await sendReminders(sysCtx(before));
    await sendReminders(sysCtx(before));
    expect(await kindsOf(a)).toEqual(['before_3']);
    expect(
      (
        await row(
          'SELECT COUNT(*) AS n FROM outbox WHERE instr(idempotency_key, ?) = 1',
          `email:invoice_reminder:${a}:`,
        )
      ).n,
    ).toBe(1);

    const subjectOf = async (key: string, at: Date) => {
      const j = await row('SELECT id FROM outbox WHERE idempotency_key = ?', key);
      expect(await processOutbox(sysCtx(at), j.id)).toEqual({ outcome: 'done' });
      return (await row('SELECT subject FROM email_logs WHERE outbox_id = ?', j.id)).subject as string;
    };
    expect(await subjectOf(`email:invoice_reminder:${a}:before_3`, before)).toMatch(/^Reminder: invoice .+ is due \d/);

    // On the due date: the "on the day" reminder says "due today" (before / on / after due, PRD §7).
    const onDay = new Date(`${due}T08:00:00Z`);
    await sendReminders(sysCtx(onDay));
    expect(await kindsOf(a)).toEqual(['before_3', 'due']);
    expect(await subjectOf(`email:invoice_reminder:${a}:due`, onDay)).toMatch(/is due today$/);

    // Ten days late: overdue (once), and only the latest reached reminder (after_7), once.
    const late = new Date(`${addDays(due, 10)}T01:00:00Z`);
    await markOverdue(sysCtx(late));
    await markOverdue(sysCtx(late));
    expect((await inv(a)).status).toBe('overdue');
    expect((await inv(paid)).status).toBe('paid');
    expect(
      (await row("SELECT COUNT(*) AS n FROM invoice_status_history WHERE invoice_id = ? AND to_status = 'overdue'", a))
        .n,
    ).toBe(1);
    await sendReminders(sysCtx(late));
    await sendReminders(sysCtx(late));
    expect(await kindsOf(a)).toEqual(['before_3', 'due', 'after_7']);
    expect(await kindsOf(paid)).toEqual([]);
    expect((await inv(a)).reminder_count).toBe(3);
    expect(
      (await row("SELECT COUNT(*) AS n FROM notifications WHERE type = 'invoice.overdue' AND entity_id = ?", a)).n,
    ).toBeGreaterThan(0);

    // A reminder queued before the invoice was paid is skipped at send time.
    const job = await row('SELECT id FROM outbox WHERE idempotency_key = ?', `email:invoice_reminder:${a}:after_7`);
    await pay(s, a, 100_000);
    expect(await processOutbox(sysCtx(late), job.id)).toEqual({ outcome: 'done' });
    expect(await row('SELECT id FROM email_logs WHERE outbox_id = ?', job.id)).toBeNull();
  });

  it('converts an accepted quotation to a draft invoice that can then be issued', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const q = await api('/api/v1/admin/quotations', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { clientId, title: 'Website', currency: 'USD', items: lines },
    });
    const qid = q.body.data.id as string;
    await api(`/api/v1/admin/quotations/${qid}/send`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    await api(`/api/v1/admin/quotations/${qid}/response`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { decision: 'accept', name: 'Tariro Banda', agree: true },
    });
    const conv = await api(`/api/v1/admin/quotations/${qid}/convert`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    const id = conv.body.data.invoiceId as string;
    const res = await issue(s, id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const detail = await api(`/api/v1/admin/invoices/${id}`, { cookie: s.cookie });
    expect(detail.body.data.quotation.id).toBe(qid);
    expect(detail.body.data.items).toHaveLength(2);
  });

  it('enforces permissions: content managers see nothing, project managers cannot record payments', async () => {
    const admin = await session(['admin']);
    const id = await draft(admin, await newClient(admin));
    await issue(admin, id, false);
    const content = await session(['content_manager']);
    expect((await api('/api/v1/admin/invoices', { cookie: content.cookie })).status).toBe(403);
    expect((await api(`/api/v1/admin/invoices/${id}`, { cookie: content.cookie })).status).toBe(403);
    const pm = await session(['project_manager']);
    expect((await pay(pm, id, 100)).status).toBe(403);
    expect((await api('/api/v1/admin/invoices', { cookie: (await session(['admin'])).cookie })).status).toBe(200);
  });
});
