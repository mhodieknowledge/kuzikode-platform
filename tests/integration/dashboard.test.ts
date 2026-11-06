import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext, type RequestContext } from '../../src/server/context';
import { getDashboard, lastTwelveMonths } from '../../src/server/modules/dashboard';
import type { AuthState } from '../../src/server/modules/auth/service';
import { ALL_PERMISSIONS, type Permission } from '../../src/shared/permissions';
import { api, login } from '../helpers/api';
import { createClient, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

/** 12:00 in Harare on 6 November 2026. */
const NOW = new Date('2026-11-06T10:00:00.000Z');

function ctxWith(perms: readonly Permission[], userId = 'usr_dash'): RequestContext {
  const ctx = createContext({ env, now: () => NOW, actor: { type: 'staff', userId } });
  ctx.auth = {
    user: { id: userId, email: 'd@example.com', name: 'D', userType: 'staff', mustChangePassword: false },
    session: { id: 'ses_x', audience: 'admin', csrfSecret: 'x', mfaVerified: true, createdAt: NOW.toISOString() },
    roles: [],
    permissions: new Set(perms),
    clientIds: [],
    mfa: { enabled: true, required: false },
  } satisfies AuthState;
  return ctx;
}

const q = (sql: string, ...p: unknown[]) => env.DB.prepare(sql).bind(...p);

/**
 * Inserts the fixture set. IDs and references get `tag` appended so later tests can add another set to the same
 * database; the exact-figures test runs first in this file (on an empty ledger) and passes no tag.
 */
async function fixtures(tag = '') {
  const t = (id: string) => `${id}${tag}`;
  const member = await createStaff([]);
  const { id: c } = await createClient('Baobab Foods');
  const inv = (
    id: string,
    cur: string,
    status: string,
    issue: string | null,
    due: string | null,
    total: number,
    paid: number,
  ) =>
    q(
      `INSERT INTO invoices (id, number, client_id, currency, status, issue_date, due_date, total_minor, amount_paid_minor, balance_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t(id),
      status === 'draft' ? null : `INV-${t(id)}`,
      c,
      cur,
      status,
      issue,
      due,
      total,
      paid,
      total - paid,
    );
  const pay = (id: string, cur: string, amount: number, at: string, status = 'completed') =>
    q(
      `INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, status, provider_reference)
       VALUES (?, ?, ?, 'manual', 'bank_transfer', ?, ?, ?, ?, ?)`,
      t(id),
      `RCT-${t(id)}`,
      c,
      amount,
      cur,
      at,
      status,
      `REF-${t(id)}`,
    );
  const alloc = (id: string, payment: string, invoice: string, amount: number) =>
    q(
      'INSERT INTO payment_allocations (id, payment_id, invoice_id, amount_minor, currency) VALUES (?, ?, ?, ?, ?)',
      t(id),
      t(payment),
      t(invoice),
      amount,
      'USD',
    );
  const refund = (id: string, payment: string, amount: number, at: string, status: string) =>
    q(
      `INSERT INTO refunds (id, payment_id, amount_minor, currency, reason, method, status, created_at)
       VALUES (?, ?, ?, 'USD', 'Goodwill', 'manual', ?, ?)`,
      t(id),
      t(payment),
      amount,
      status,
      at,
    );
  const project = (id: string, ref: string, status: string) =>
    q(
      'INSERT INTO projects (id, reference, client_id, name, status) VALUES (?, ?, ?, ?, ?)',
      t(id),
      t(ref),
      c,
      `Project ${ref}`,
      status,
    );
  const milestone = (id: string, project: string, due: string, status: string) =>
    q(
      'INSERT INTO project_milestones (id, project_id, title, due_date, status) VALUES (?, ?, ?, ?, ?)',
      t(id),
      t(project),
      `Milestone ${id}`,
      due,
      status,
    );
  const quote = (id: string, status: string, validUntil: string, total: number) =>
    q(
      `INSERT INTO quotations (id, number, client_id, title, currency, status, valid_until, total_minor)
       VALUES (?, ?, ?, 'Website', 'USD', ?, ?, ?)`,
      t(id),
      `QUO-${t(id)}`,
      c,
      status,
      validUntil,
      total,
    );
  const enquiry = (id: string, kind: string, status: string, at: string) =>
    q(
      `INSERT INTO enquiries (id, reference, kind, name, email, category, message, consent_at, status, created_at)
       VALUES (?, ?, ?, 'Ann', 'ann@example.com', 'general', 'Hello', ?, ?, ?)`,
      t(id),
      `ENQ-${t(id)}`,
      kind,
      at,
      status,
      at,
    );
  const posting = (id: string, status: string) =>
    q(
      `INSERT INTO job_postings (id, slug, title, department, location, employment_type, workplace, summary, status)
       VALUES (?, ?, 'Developer', 'Engineering', 'Harare', 'full_time', 'hybrid', 'Build things', ?)`,
      t(id),
      `role-${t(id)}`,
      status,
    );
  const application = (id: string, status: string, at: string) =>
    q(
      `INSERT INTO job_applications (id, posting_id, reference, full_name, email, consent_at, status, created_at)
       VALUES (?, ?, ?, 'Tino', 'tino@example.com', ?, ?, ?)`,
      t(id),
      t('jp1'),
      `APP-${t(id)}`,
      at,
      status,
      at,
    );
  await env.DB.batch([
    inv('i1', 'USD', 'paid', '2026-10-01', '2026-10-15', 100_000, 100_000),
    inv('i2', 'USD', 'partially_paid', '2026-11-02', '2026-11-10', 50_000, 20_000),
    inv('i3', 'USD', 'overdue', '2026-09-01', '2026-09-15', 40_000, 0),
    inv('i4', 'ZWG', 'issued', '2026-11-03', '2026-12-30', 700_000, 0),
    inv('i5', 'USD', 'draft', null, null, 9_999, 0),
    inv('i6', 'USD', 'void', '2026-08-01', '2026-08-15', 12_345, 0),
    pay('p1', 'USD', 100_000, '2026-10-20T08:00:00.000Z'),
    // 22:30 UTC on 31 October is 00:30 on 1 November in Harare: counts for November.
    pay('p2', 'USD', 20_000, '2026-10-31T22:30:00.000Z'),
    pay('p3', 'USD', 5_000, '2026-11-03T09:00:00.000Z', 'reversed'),
    // Before the 12-month window (which starts 1 December 2025): all-time only.
    pay('p4', 'ZWG', 300_000, '2025-11-15T09:00:00.000Z'),
    alloc('a1', 'p1', 'i1', 100_000),
    alloc('a2', 'p2', 'i2', 20_000),
    refund('r1', 'p1', 10_000, '2026-11-04T09:00:00.000Z', 'completed'),
    refund('r2', 'p1', 7_000, '2026-11-04T09:00:00.000Z', 'failed'),
    project('pr1', 'PRJ-1', 'active'),
    project('pr2', 'PRJ-2', 'completed'),
    project('pr3', 'PRJ-3', 'active'),
    q("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')", t('pr1'), member.id),
    milestone('m1', 'pr1', '2026-11-20', 'pending'),
    milestone('m2', 'pr1', '2026-12-30', 'pending'),
    milestone('m3', 'pr3', '2026-11-12', 'in_progress'),
    milestone('m4', 'pr3', '2026-11-08', 'completed'),
    quote('q1', 'sent', '2026-11-30', 25_000),
    quote('q2', 'viewed', '2026-11-01', 30_000),
    quote('q3', 'accepted', '2026-11-30', 40_000),
    enquiry('e1', 'contact', 'new', '2026-11-04T09:00:00.000Z'),
    enquiry('e2', 'wizard', 'triaged', '2026-11-05T09:00:00.000Z'),
    enquiry('e3', 'contact', 'spam', '2026-11-05T09:00:00.000Z'),
    enquiry('e4', 'wizard', 'new', '2026-10-25T09:00:00.000Z'),
    posting('jp1', 'open'),
    posting('jp2', 'closed'),
    application('ja1', 'new', '2026-11-04T09:00:00.000Z'),
    application('ja2', 'new', '2026-10-20T09:00:00.000Z'),
    application('ja3', 'screening', '2026-11-05T09:00:00.000Z'),
  ]);
  return { member };
}

describe('dashboard (P4.17)', () => {
  beforeEach(() => seedBase());

  it('lists the last 12 business months, oldest first', () => {
    expect(lastTwelveMonths('2026-11-06')).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
  });

  it('figures match the fixtures exactly: per currency, net of refunds, reversals and drafts excluded', async () => {
    await fixtures();
    const d = await getDashboard(ctxWith(ALL_PERMISSIONS));
    const f = d.financial!;
    expect(f.revenueAllTime).toEqual([
      { currency: 'USD', amountMinor: 110_000 },
      { currency: 'ZWG', amountMinor: 300_000 },
    ]);
    expect(f.revenueThisMonth).toEqual([{ currency: 'USD', amountMinor: 10_000 }]);
    expect(f.outstanding).toEqual([
      { currency: 'USD', amountMinor: 70_000, count: 2 },
      { currency: 'ZWG', amountMinor: 700_000, count: 1 },
    ]);
    expect(f.overdue).toEqual([{ currency: 'USD', amountMinor: 40_000, count: 1 }]);
    const zeros = Array(12).fill(0) as number[];
    const at = (vals: Record<number, number>) => zeros.map((z, i) => vals[i] ?? z);
    // Index 10 = October 2026, 11 = November 2026, 9 = September.
    expect(f.charts.revenue).toEqual([{ currency: 'USD', values: at({ 10: 100_000, 11: 10_000 }) }]);
    expect(f.charts.issued).toEqual(at({ 9: 1, 10: 1, 11: 2 }));
    expect(f.charts.paid).toEqual(at({ 10: 1 }));

    expect(d.quotations).toEqual({ pending: 1, pendingValue: [{ currency: 'USD', amountMinor: 25_000, count: 1 }] });
    expect(d.projects?.active).toBe(2);
    expect(d.projects?.completed).toBe(1);
    expect(d.projects?.upcomingMilestones.map((m) => [m.id, m.dueDate])).toEqual([
      ['m3', '2026-11-12'],
      ['m1', '2026-11-20'],
    ]);
    expect(d.enquiries).toEqual({ last7Days: 2, briefs7Days: 1 });
    expect(d.careers).toEqual({ openRoles: 1, newApplicants7Days: 1 });
    expect(d.recentPayments?.map((p) => p.receiptNumber)).toEqual(['RCT-p3', 'RCT-p2', 'RCT-p1', 'RCT-p4']);
    expect(d.recentPayments?.[1]).toMatchObject({ client: 'Baobab Foods', providerReference: 'REF-p2' });
    expect(d.dueInvoices?.map((i) => [i.number, i.balanceMinor])).toEqual([['INV-i2', 30_000]]);
    expect(d.activity).not.toBeNull();
  });

  it('filters by permission: members see only their projects; no financial figures without dashboard.financial', async () => {
    const { member } = await fixtures('_perm');
    const d = await getDashboard(ctxWith(['dashboard.view', 'projects.view', 'support.view'], member.id));
    expect(d.financial).toBeNull();
    expect(d.recentPayments).toBeNull();
    expect(d.dueInvoices).toBeNull();
    expect(d.quotations).toBeNull();
    expect(d.activity).toBeNull();
    expect(d.enquiries).toBeNull();
    expect(d.careers).toBeNull();
    expect(d.projects).toMatchObject({ active: 1, completed: 0 });
    expect(d.projects?.upcomingMilestones.map((m) => m.id)).toEqual(['m1_perm']);
    const none = await getDashboard(ctxWith([]));
    expect(Object.values(none).filter((v) => v !== null && typeof v === 'object')).toEqual([]);
  });

  it('serves the same figures over the admin API, filtered by the signed-in role', async () => {
    await fixtures('_api');
    const admin = await createStaff(['admin']);
    const s = await login('admin', admin.email, admin.password);
    const d = (await api('/api/v1/admin/dashboard', { cookie: s.cookie })).body.data;
    const direct = await getDashboard(
      Object.assign(ctxWith(ALL_PERMISSIONS, admin.id), { now: () => new Date() }) as RequestContext,
    );
    expect(d.financial.outstanding).toEqual(direct.financial!.outstanding);
    expect(d.financial.revenueAllTime).toEqual(direct.financial!.revenueAllTime);
    const support = await createStaff(['support_staff']);
    const s2 = await login('admin', support.email, support.password);
    const d2 = (await api('/api/v1/admin/dashboard', { cookie: s2.cookie })).body.data;
    expect(d2.financial).toBeNull();
    expect(d2.recentPayments).toBeNull();
    expect((await api('/api/v1/admin/dashboard')).status).toBe(401);
  });
});
