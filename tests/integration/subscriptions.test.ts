import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  billSubscriptions,
  clientServices,
  flagAtRisk,
  nextAnchored,
  periodEnd,
  periodLabel,
  recurringRevenue,
  sendRenewalReminders,
} from '../../src/server/modules/subscriptions';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const A = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
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
const sys = (iso: string) => createContext({ env, now: () => new Date(iso), actor: { type: 'system', userId: null } });

async function newClient(s: S, name = 'Baobab Foods') {
  const res = await A(s, '/clients', {
    type: 'business',
    displayName: name,
    email: 'accounts@baobab.example',
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
    primaryContact: { name: 'Tariro Banda', email: 'tariro@baobab.example' },
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}
const sub = (clientId: string, over: Record<string, unknown> = {}) => ({
  clientId,
  description: 'Business Email, 10 mailboxes',
  quantity: '10',
  unitPriceMinor: 300,
  currency: 'USD',
  interval: 'month',
  startDate: '2026-12-01',
  autoIssue: false,
  ...over,
});

describe('subscriptions & managed services (P4.20)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });

  it('anchors billing dates to the start date and labels periods', () => {
    expect(nextAnchored('2026-01-31', '2026-01-31', 'month')).toBe('2026-02-28');
    expect(nextAnchored('2026-01-31', '2026-02-28', 'month')).toBe('2026-03-31');
    expect(periodEnd('2026-02-28', 'month', '2026-01-31')).toBe('2026-03-30');
    expect(periodEnd('2026-12-01', 'month')).toBe('2026-12-31');
    expect(periodEnd('2026-03-15', 'year')).toBe('2027-03-14');
    expect(periodLabel('2026-12-01', '2026-12-31')).toBe('1–31 Dec 2026');
    expect(periodLabel('2026-12-15', '2027-01-14')).toBe('15 Dec 2026–14 Jan 2027');
  });

  it('daily billing creates each period once: rerun and concurrent runs never invoice twice', async () => {
    const admin = await staff(['admin']);
    const clientId = await newClient(admin);
    const created = await A(admin, '/subscriptions', sub(clientId));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id as string;
    // 24 Nov: 1 Dec is beyond the 7-day lead time.
    expect((await billSubscriptions(sys('2026-11-23T08:00:00Z'))).invoices).toBe(0);
    // 25 Nov (Harare): 1 Dec is within 7 days. Two overlapping runs, then a third.
    const ctx = sys('2026-11-25T08:00:00Z');
    const [a, b] = await Promise.all([billSubscriptions(ctx), billSubscriptions(ctx)]);
    const c = await billSubscriptions(ctx);
    expect(a.invoices + b.invoices + c.invoices).toBe(1);
    const invoices = await all('SELECT * FROM invoices WHERE subscription_id = ?', id);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ status: 'draft', total_minor: 3_000, currency: 'USD', client_id: clientId });
    const item = await row('SELECT * FROM invoice_items WHERE invoice_id = ?', invoices[0].id);
    expect(item).toMatchObject({
      description: 'Business Email, 10 mailboxes, 1–31 Dec 2026',
      quantity_milli: 10_000,
      unit_price_minor: 300,
      period_start: '2026-12-01',
      period_end: '2026-12-31',
    });
    expect(await row('SELECT next_billing_date FROM subscriptions WHERE id = ?', id)).toEqual({
      next_billing_date: '2027-01-01',
    });
    expect((await all('SELECT * FROM subscription_periods WHERE subscription_id = ?', id)).length).toBe(1);
    expect(
      await row(
        "SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'invoice.created_by_subscription'",
        invoices[0].id,
      ),
    ).toBeTruthy();
    // The detail shows the history and the next invoice preview.
    const detail = (await A(admin, `/subscriptions/${id}`)).body.data;
    expect(detail.periods.map((p: any) => p.period_start)).toEqual(['2026-12-01']);
    expect(detail.nextInvoice).toMatchObject({ periodStart: '2027-01-01', periodEnd: '2027-01-31', totalMinor: 3_000 });
  });

  it('catches up missed periods on the anchored schedule and auto-issues when asked', async () => {
    const admin = await staff(['admin']);
    const clientId = await newClient(admin);
    const id = (await A(admin, '/subscriptions', sub(clientId, { startDate: '2026-08-31', autoIssue: true }))).body.data
      .id as string;
    const res = await billSubscriptions(sys('2026-11-06T08:00:00Z'));
    expect(res).toMatchObject({ invoices: 3, issued: 3 });
    const periods = await all(
      'SELECT period_start, period_end FROM subscription_periods WHERE subscription_id = ? ORDER BY period_start',
      id,
    );
    expect(periods.map((p) => [p.period_start, p.period_end])).toEqual([
      ['2026-08-31', '2026-09-29'],
      ['2026-09-30', '2026-10-30'],
      ['2026-10-31', '2026-11-29'],
    ]);
    const issued = await all(
      'SELECT number, status FROM invoices WHERE subscription_id = ? AND number IS NOT NULL',
      id,
    );
    expect(issued).toHaveLength(3);
    expect(
      (
        await all(
          "SELECT id FROM outbox WHERE idempotency_key LIKE 'email:invoice_issued:%' AND payload LIKE ?",
          '%baobab%',
        )
      ).length,
    ).toBe(3);
    expect(await row('SELECT next_billing_date FROM subscriptions WHERE id = ?', id)).toEqual({
      next_billing_date: '2026-11-30',
    });
  });

  it('pause stops billing, resume does not back-bill, cancel stops for good; edits respect billed periods', async () => {
    const admin = await staff(['admin']);
    const clientId = await newClient(admin);
    const id = (await A(admin, '/subscriptions', sub(clientId, { startDate: '2026-10-01' }))).body.data.id as string;
    await billSubscriptions(sys('2026-10-01T08:00:00Z')); // bills October
    expect((await A(admin, `/subscriptions/${id}/pause`, {})).status).toBe(200);
    const count = async () =>
      (await row('SELECT COUNT(*) AS n FROM invoices WHERE subscription_id = ?', id)).n as number;
    expect(await count()).toBe(1);
    await billSubscriptions(sys('2027-01-10T08:00:00Z'));
    expect(await count()).toBe(1); // paused: nothing billed
    // Resume "today" (real clock, Nov 2026 or later): next billing moves to the first scheduled date ≥ today.
    expect((await A(admin, `/subscriptions/${id}/resume`, {})).status).toBe(200);
    const next = (await row('SELECT next_billing_date, status FROM subscriptions WHERE id = ?', id)) as any;
    expect(next.status).toBe('active');
    expect(next.next_billing_date >= new Date().toISOString().slice(0, 10)).toBe(true);
    expect(next.next_billing_date.slice(8)).toBe('01');
    // Interval and currency are fixed once billed.
    const bad = await A(
      admin,
      `/subscriptions/${id}`,
      sub(clientId, { startDate: '2026-10-01', interval: 'year' }),
      'PUT',
    );
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.interval).toBeTruthy();
    const ok = await A(
      admin,
      `/subscriptions/${id}`,
      sub(clientId, { startDate: '2026-10-01', quantity: '12', nextBillingDate: next.next_billing_date }),
      'PUT',
    );
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((await A(admin, `/subscriptions/${id}/cancel`, { reason: 'Moved to another provider.' })).status).toBe(200);
    await billSubscriptions(sys('2028-01-10T08:00:00Z'));
    expect(await count()).toBe(1);
    expect((await A(admin, `/subscriptions/${id}`, sub(clientId), 'PUT')).status).toBe(409);
    // Finance can view, support can't.
    const support = await staff(['support_staff']);
    expect((await A(support, '/subscriptions')).status).toBe(403);
  });

  it('flags a subscription "at risk" after 30 days overdue and clears it once paid', async () => {
    const admin = await staff(['admin']);
    const clientId = await newClient(admin);
    const id = (await A(admin, '/subscriptions', sub(clientId, { startDate: '2026-11-25', autoIssue: true }))).body.data
      .id as string;
    await billSubscriptions(sys('2026-11-25T08:00:00Z'));
    const inv = await row('SELECT id, due_date, total_minor FROM invoices WHERE subscription_id = ?', id);
    expect(inv.due_date).toBe('2026-12-09');
    const status = async () => (await row('SELECT status FROM subscriptions WHERE id = ?', id)).status as string;
    await flagAtRisk(sys('2027-01-05T08:00:00Z')); // 27 days overdue
    expect(await status()).toBe('active');
    expect((await flagAtRisk(sys('2027-01-10T08:00:00Z'))).flagged).toBeGreaterThanOrEqual(1); // 32 days
    expect(await status()).toBe('at_risk');
    expect(
      (await row("SELECT COUNT(*) AS n FROM notifications WHERE type = 'subscription.alert' AND entity_id = ?", id)).n,
    ).toBeGreaterThan(0);
    // At-risk subscriptions keep billing (nobody's service is suspended automatically).
    expect((await recurringRevenue(sys('2027-01-10T08:00:00Z'))).find((r) => r.currency === 'USD')).toBeTruthy();
    const paid = await A(admin, `/invoices/${inv.id}/payments`, {
      amountMinor: inv.total_minor,
      method: 'bank_transfer',
      receivedOn: new Date().toISOString().slice(0, 10),
    });
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    expect((await flagAtRisk(sys('2027-01-11T08:00:00Z'))).cleared).toBeGreaterThanOrEqual(1);
    expect(await status()).toBe('active');
  });

  it('MRR/ARR per currency: yearly plans count 1/12, paused and cancelled ones not at all; the dashboard tile agrees', async () => {
    await env.DB.prepare("UPDATE subscriptions SET status = 'ended' WHERE status IN ('active','at_risk')").run();
    const admin = await staff(['admin']);
    const clientId = await newClient(admin);
    await A(admin, '/subscriptions', sub(clientId)); // 10 × $3 / month = $30
    await A(
      admin,
      '/subscriptions',
      sub(clientId, { description: 'Hosting', quantity: '1', unitPriceMinor: 12_000, interval: 'year' }),
    ); // $10/month
    const paused = (
      await A(admin, '/subscriptions', sub(clientId, { description: 'Old plan', unitPriceMinor: 99_999 }))
    ).body.data.id;
    await A(admin, `/subscriptions/${paused}/pause`, {});
    await A(
      admin,
      '/subscriptions',
      sub(clientId, { description: 'Hosting ZWG', currency: 'ZWG', quantity: '1', unitPriceMinor: 100_000 }),
    );
    const rr = await recurringRevenue(sys('2026-11-25T08:00:00Z'));
    expect(rr).toEqual([
      { currency: 'USD', mrrMinor: 4_000, arrMinor: 48_000, count: 2 },
      { currency: 'ZWG', mrrMinor: 100_000, arrMinor: 1_200_000, count: 1 },
    ]);
    const dash = (await api('/api/v1/admin/dashboard', { cookie: admin.cookie })).body.data;
    expect(dash.recurring).toEqual(rr);
    expect((await A(admin, '/subscriptions')).body.data.mrr).toEqual(rr);
  });

  it('accepting a quotation turns its recurring lines into subscriptions billed from the second period', async () => {
    const admin = await staff(['admin']);
    const clientId = await newClient(admin);
    const q = await A(admin, '/quotations', {
      clientId,
      title: 'Email setup',
      currency: 'USD',
      items: [
        {
          description: 'Email setup & migration',
          quantity: '1',
          unitPriceMinor: 5_000,
          discountType: 'none',
          discountValue: 0,
        },
        {
          description: 'Business Email\nIncludes: 10 mailboxes',
          quantity: '10',
          unitPriceMinor: 300,
          discountType: 'none',
          discountValue: 0,
          isRecurring: true,
          recurringInterval: 'month',
        },
      ],
    });
    expect(q.status, JSON.stringify(q.body)).toBe(201);
    const id = q.body.data.id as string;
    await A(admin, `/quotations/${id}/send`, {});
    expect(
      (await A(admin, `/quotations/${id}/response`, { decision: 'accept', name: 'Tariro Banda', agree: true })).status,
    ).toBe(200);
    const subs = await all('SELECT * FROM subscriptions WHERE source_quotation_id = ?', id);
    expect(subs).toHaveLength(1);
    const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
    expect(subs[0]).toMatchObject({
      client_id: clientId,
      description: 'Business Email',
      quantity_milli: 10_000,
      unit_price_minor: 300,
      interval: 'month',
      start_date: today,
      status: 'active',
      auto_issue: 0,
    });
    expect(subs[0].next_billing_date > today).toBe(true);
  });

  it('register: no passwords, unique names, reminders once per window (client email only when billable)', async () => {
    const admin = await staff(['admin']);
    const clientId = await newClient(admin);
    const base = { clientId, type: 'domain', name: 'baobab.co.zw', provider: 'ZISPA', renewalDate: '2026-12-05' };
    const pw = await A(admin, '/assets', { ...base, credentialsNote: 'password: hunter2' });
    expect(pw.status).toBe(422);
    expect(pw.body.error.fields.credentialsNote).toBeTruthy();
    const created = await A(admin, '/assets', {
      ...base,
      credentialsNote: "In the owner's password manager",
      costNote: '$15/yr',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id as string;
    expect((await A(admin, '/assets', base)).body.error.fields.name).toBeTruthy();
    const internal = (
      await A(admin, '/assets', {
        ...base,
        name: 'baobab-internal.co.zw',
        billableToClient: false,
        renewalDate: '2026-12-01',
      })
    ).body.data.id;
    // 25 Nov: renews in 10 and 6 days → the 14-day and 7-day windows.
    const ctx = sys('2026-11-25T08:00:00Z');
    expect(await sendRenewalReminders(ctx)).toBe(2);
    expect(await sendRenewalReminders(ctx)).toBe(0);
    expect(await all('SELECT kind FROM asset_reminders WHERE asset_id = ?', id)).toEqual([{ kind: '14d' }]);
    expect(await all('SELECT kind FROM asset_reminders WHERE asset_id = ?', internal)).toEqual([{ kind: '7d' }]);
    const emails = await all(
      "SELECT idempotency_key, payload FROM outbox WHERE idempotency_key LIKE 'email:renewal:%'",
    );
    expect(emails.map((e) => e.idempotency_key)).toEqual([`email:renewal:${id}:2026-12-05:14d`]);
    expect(JSON.parse(emails[0].payload)).toMatchObject({ template: 'renewal_reminder', to: 'tariro@baobab.example' });
    expect(
      (await row("SELECT COUNT(*) AS n FROM notifications WHERE type = 'renewal.upcoming' AND entity_id = ?", id)).n,
    ).toBeGreaterThan(0);
    // 30 Nov: 5 days → the 7-day reminder for the first one.
    expect(await sendRenewalReminders(sys('2026-11-30T08:00:00Z'))).toBe(1);
    // The client view never carries internal notes.
    const view = await clientServices(ctx, clientId);
    expect(view.assets.map((a) => a.name).sort()).toEqual(['baobab-internal.co.zw', 'baobab.co.zw']);
    expect(JSON.stringify(view)).not.toContain('password manager');
    expect(JSON.stringify(view)).not.toContain('$15/yr');
    // Audit rows never copy the notes either.
    expect(JSON.stringify(await all('SELECT after FROM audit_logs WHERE entity_id = ?', id))).not.toContain('password');
    expect((await A(admin, `/assets/${id}`, undefined, 'DELETE')).status).toBe(200);
  });
});
