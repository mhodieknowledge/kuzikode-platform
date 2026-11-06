import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createContext, type RequestContext } from '../../src/server/context';
import type { AuthState } from '../../src/server/modules/auth/service';
import {
  ageing,
  conversion,
  expensesByCategory,
  invoicedByService,
  profitIndicator,
  resolveRange,
  revenueByClient,
  revenueByMonth,
} from '../../src/server/modules/reports';
import { ALL_PERMISSIONS, type Permission } from '../../src/shared/permissions';
import { api, login } from '../helpers/api';
import { createClient, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const NOW = new Date('2031-06-30T10:00:00.000Z');
function ctxWith(perms: readonly Permission[]): RequestContext {
  const ctx = createContext({ env, now: () => NOW, actor: { type: 'staff', userId: 'usr_reports' } });
  ctx.auth = {
    user: { id: 'usr_reports', email: 'r@example.com', name: 'R', userType: 'staff', mustChangePassword: false },
    session: { id: 'ses_r', audience: 'admin', csrfSecret: 'x', mfaVerified: true, createdAt: NOW.toISOString() },
    roles: [],
    permissions: new Set(perms),
    clientIds: [],
    clientRoles: {},
    mfa: { enabled: true, required: false },
  } satisfies AuthState;
  return ctx;
}
const q = (sql: string, ...p: unknown[]) => env.DB.prepare(sql).bind(...p);
const R = { from: '2031-03-01', to: '2031-04-30' };

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const A = (s: S, path: string) => api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf });

/** One fixture set in 2031 so nothing else in the database falls inside the report range. */
async function fixtures() {
  const { id: a } = await createClient('Acacia Ltd');
  const { id: b } = await createClient('Baobab Foods');
  const pay = (id: string, client: string, cur: string, amount: number, at: string, status = 'completed') =>
    q(
      `INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, status)
       VALUES (?, ?, ?, 'manual', 'bank_transfer', ?, ?, ?, ?)`,
      id,
      `RCT-${id}`,
      client,
      amount,
      cur,
      at,
      status,
    );
  const item = (id: string, inv: string, pos: number, service: string | null, total: number) =>
    q(
      `INSERT INTO invoice_items (id, invoice_id, position, service_id, description, quantity_milli, unit_price_minor,
         line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor) VALUES (?, ?, ?, ?, 'Line', 1000, ?, ?, 0, 0, ?)`,
      id,
      inv,
      pos,
      service,
      total,
      total,
      total,
    );
  const draft = (
    id: string,
    client: string,
    cur: string,
    issue: string | null,
    due: string | null,
    total: number,
    balance: number,
  ) =>
    q(
      `INSERT INTO invoices (id, client_id, currency, status, issue_date, due_date, total_minor, balance_minor)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
      id,
      client,
      cur,
      issue,
      due,
      total,
      balance,
    );
  const setStatus = (id: string, status: string) =>
    q('UPDATE invoices SET status = ?, number = ? WHERE id = ?', status, `INV-${id}`, id);
  const web = 'svc_web_development__business_websites';
  await env.DB.batch([
    // Revenue: 15,000 USD from Acacia (one payment lands on 1 April in Harare), 2,000 refunded in April, one reversed payment.
    pay('pay_r1', a, 'USD', 10_000, '2031-03-01T10:00:00.000Z'),
    pay('pay_r2', a, 'USD', 5_000, '2031-03-31T22:30:00.000Z'),
    pay('pay_r3', a, 'USD', 9_999, '2031-04-02T10:00:00.000Z', 'reversed'),
    pay('pay_r4', b, 'ZWG', 700_000, '2031-04-10T10:00:00.000Z'),
    pay('pay_r5', a, 'USD', 1_234, '2031-05-02T10:00:00.000Z'), // outside the range
    q(
      `INSERT INTO refunds (id, payment_id, amount_minor, currency, reason, method, status, created_at)
       VALUES ('ref_r1', 'pay_r1', 2000, 'USD', 'Duplicate', 'manual', 'completed', '2031-04-05T10:00:00.000Z')`,
    ),
    q(
      `INSERT INTO refunds (id, payment_id, amount_minor, currency, reason, method, status, created_at)
       VALUES ('ref_r2', 'pay_r1', 500, 'USD', 'Failed transfer', 'manual', 'failed', '2031-04-06T10:00:00.000Z')`,
    ),
    // Invoiced by service: issued (paid) USD invoice with a service line and a custom line; void and draft are ignored.
    draft('inv_r1', a, 'USD', '2031-03-05', '2031-03-19', 10_000, 0),
    item('iit_r1a', 'inv_r1', 1, web, 8_000),
    item('iit_r1b', 'inv_r1', 2, null, 2_000),
    setStatus('inv_r1', 'paid'),
    draft('inv_r2', a, 'USD', '2031-03-06', '2031-03-20', 5_000, 5_000),
    item('iit_r2', 'inv_r2', 1, web, 5_000),
    setStatus('inv_r2', 'void'),
    draft('inv_r3', a, 'USD', '2031-03-07', null, 7_000, 7_000),
    item('iit_r3', 'inv_r3', 1, web, 7_000),
    draft('inv_r4', b, 'ZWG', '2031-04-01', '2031-04-15', 300_000, 0),
    item('iit_r4', 'inv_r4', 1, web, 300_000),
    setStatus('inv_r4', 'paid'),
    // Ageing as of 30 June 2031.
    draft('inv_a1', b, 'USD', '2031-06-20', '2031-07-10', 1_000, 1_000),
    draft('inv_a2', b, 'USD', '2031-06-01', '2031-06-15', 2_000, 2_000),
    draft('inv_a3', b, 'USD', '2031-04-15', '2031-05-01', 3_000, 3_000),
    draft('inv_a4', b, 'USD', '2031-02-15', '2031-03-01', 4_000, 4_000),
    draft('inv_a5', b, 'USD', '2031-03-15', '2031-04-01', 500, 500),
    setStatus('inv_a1', 'issued'),
    setStatus('inv_a2', 'partially_paid'),
    setStatus('inv_a3', 'overdue'),
    setStatus('inv_a4', 'overdue'),
    setStatus('inv_a5', 'overdue'),
    // Conversion: six quotations sent in range (2 accepted), one void and one draft ignored.
    ...(
      [
        ['quo_r1', 'accepted', 10_000],
        ['quo_r2', 'accepted', 5_000],
        ['quo_r3', 'rejected', 1_000],
        ['quo_r4', 'expired', 1_000],
        ['quo_r5', 'viewed', 1_000],
        ['quo_r6', 'sent', 1_000],
        ['quo_r7', 'void', 1_000],
      ] as const
    ).map(([id, status, total]) =>
      q(
        "INSERT INTO quotations (id, client_id, title, currency, status, total_minor, sent_at) VALUES (?, ?, 'Q', 'USD', ?, ?, '2031-03-10T10:00:00.000Z')",
        id,
        a,
        status,
        total,
      ),
    ),
    q(
      "INSERT INTO quotations (id, client_id, title, currency, status, total_minor) VALUES ('quo_r8', ?, 'Q', 'USD', 'draft', 1)",
      a,
    ),
    // Expenses.
    q("INSERT INTO expense_categories (id, name) VALUES ('exc_r_hosting', 'Hosting (reports)')"),
    q("INSERT INTO expense_categories (id, name) VALUES ('exc_r_travel', 'Travel (reports)')"),
    ...(
      [
        ['exp_r1', 'exc_r_hosting', '2031-03-10', 1_500, 'USD', 'recorded'],
        ['exp_r2', 'exc_r_hosting', '2031-04-10', 500, 'USD', 'recorded'],
        ['exp_r3', 'exc_r_travel', '2031-04-10', 9_999, 'USD', 'void'],
        ['exp_r4', 'exc_r_travel', '2031-04-11', 100_000, 'ZWG', 'recorded'],
      ] as const
    ).map(([id, cat, date, amount, cur, status]) =>
      q(
        "INSERT INTO expenses (id, category_id, expense_date, description, amount_minor, currency, status) VALUES (?, ?, ?, 'x', ?, ?, ?)",
        id,
        cat,
        date,
        amount,
        cur,
        status,
      ),
    ),
  ]);
  return { a, b };
}

describe('reports (P4.18)', () => {
  beforeAll(async () => {
    await seedBase();
    await fixtures();
  });
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });
  const ctx = () => ctxWith(ALL_PERMISSIONS);

  it('revenue by month and by client: Harare months, refunds deducted when made, reversals and failed refunds ignored', async () => {
    expect(await revenueByMonth(ctx(), R)).toEqual([
      { month: '2031-03', currency: 'USD', receivedMinor: 10_000, refundedMinor: 0, netMinor: 10_000 },
      { month: '2031-04', currency: 'USD', receivedMinor: 5_000, refundedMinor: 2_000, netMinor: 3_000 },
      { month: '2031-04', currency: 'ZWG', receivedMinor: 700_000, refundedMinor: 0, netMinor: 700_000 },
    ]);
    const byClient = await revenueByClient(ctx(), R);
    expect(byClient.map((r) => [r.client, r.currency, r.received, r.refunded, r.net])).toEqual([
      ['Acacia Ltd', 'USD', 15_000, 2_000, 13_000],
      ['Baobab Foods', 'ZWG', 700_000, 0, 700_000],
    ]);
  });

  it('invoiced by service, ageing buckets, quotation conversion, expenses and indicative profit', async () => {
    expect((await invoicedByService(ctx(), R)).map((r) => [r.service, r.currency, r.amount])).toEqual([
      ['Corporate & business websites', 'USD', 8_000],
      ['Other (custom lines)', 'USD', 2_000],
      ['Corporate & business websites', 'ZWG', 300_000],
    ]);

    const aged = await ageing(ctx(), '2031-06-30');
    const usd = aged.summary.find((s) => s.currency === 'USD')!;
    expect(usd.current).toEqual({ amountMinor: 1_000, count: 1 });
    expect(usd.d1_30).toEqual({ amountMinor: 2_000, count: 1 });
    expect(usd.d31_60).toEqual({ amountMinor: 3_000, count: 1 }); // 60 days
    expect(usd.d61_90).toEqual({ amountMinor: 500, count: 1 }); // 90 days
    expect(usd.d90_plus).toEqual({ amountMinor: 4_000, count: 1 }); // 121 days
    expect(usd.totalMinor).toBe(10_500);
    // Paid, void and draft invoices are never ageing.
    expect(aged.invoices.map((i) => i.id)).not.toContain('inv_r3');

    expect(await conversion(ctx(), R)).toEqual({
      sent: 6,
      accepted: 2,
      rejected: 1,
      expired: 1,
      open: 2,
      rateBp: 3333,
      acceptedValue: [{ currency: 'USD', amountMinor: 15_000, count: 2 }],
    });

    expect((await expensesByCategory(ctx(), R)).map((e) => [e.category, e.currency, e.amount, e.n])).toEqual([
      ['Hosting (reports)', 'USD', 2_000, 2],
      ['Travel (reports)', 'ZWG', 100_000, 1],
    ]);
    expect(await profitIndicator(ctx(), R)).toEqual([
      { currency: 'USD', revenueMinor: 13_000, expensesMinor: 2_000, profitMinor: 11_000 },
      { currency: 'ZWG', revenueMinor: 700_000, expensesMinor: 100_000, profitMinor: 600_000 },
    ]);
    // Default range: twelve business months ending today.
    expect(resolveRange(ctx(), {})).toEqual({ from: '2030-07-01', to: '2031-06-30' });
    expect(resolveRange(ctx(), { from: '2031-05-01', to: '2031-01-01' })).toEqual({
      from: '2031-01-01',
      to: '2031-05-01',
    });
  });

  it('API: reports.view vs reports.export; CSVs carry plain per-currency amounts, labels and an audit row', async () => {
    const support = await staff(['support_staff']);
    expect((await A(support, '/reports')).status).toBe(403);
    const pm = await staff(['project_manager']);
    expect((await A(pm, '/reports')).status).toBe(403);
    const admin = await staff(['admin']);
    const res = await A(admin, `/reports?from=${R.from}&to=${R.to}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profit).toHaveLength(2);
    const csv = await A(admin, `/reports/export.csv?report=profit&from=${R.from}&to=${R.to}`);
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-disposition')).toContain('profit-2031-03-01-2031-04-30.csv');
    const lines = String(csv.body).trim().split('\r\n');
    expect(lines[0]).toBe('Period 2031-03-01 to 2031-04-30 (Africa/Harare)');
    expect(lines[1]).toContain('Indicative only');
    expect(lines.slice(3)).toEqual(['USD,130.00,20.00,110.00', 'ZWG,7000.00,1000.00,6000.00']);
    const exp = String((await A(admin, `/reports/export.csv?report=expenses&from=${R.from}&to=${R.to}`)).body);
    expect(exp).toContain('This is not a statutory accounting system');
    const aged = String((await A(admin, '/reports/export.csv?report=ageing')).body);
    expect(aged.split('\r\n')[1]).toBe('Invoice,Client,Currency,Due date,Days overdue,Bucket,Balance');
    expect((await A(admin, '/reports/export.csv?report=bogus')).status).toBe(422);
    const row = await env.DB.prepare(
      "SELECT after FROM audit_logs WHERE action = 'report.exported' AND entity_id = 'profit' ORDER BY created_at DESC LIMIT 1",
    ).first<{ after: string }>();
    expect(JSON.parse(row!.after)).toEqual({ from: '2031-03-01', to: '2031-04-30' });
  });
});

describe('audit log viewer and data export (P4.18)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });

  it('filters by actor, entity, action prefix and date; finance roles see finance entities only; export is audited', async () => {
    const admin = await staff(['admin']);
    await env.DB.batch([
      q(
        "INSERT INTO audit_logs (id, actor_user_id, actor_type, action, entity_type, entity_id, after, created_at) VALUES ('aud_t1', ?, 'staff', 'invoice.issued', 'invoice', 'inv_x', '{\"n\":1}', '2031-01-10T22:30:00.000Z')",
        admin.id,
      ),
      q(
        "INSERT INTO audit_logs (id, actor_user_id, actor_type, action, entity_type, entity_id, created_at) VALUES ('aud_t2', ?, 'staff', 'user.invited', 'user', 'usr_x', '2031-01-11T08:00:00.000Z')",
        admin.id,
      ),
      q(
        "INSERT INTO audit_logs (id, actor_user_id, actor_type, action, entity_type, entity_id, created_at) VALUES ('aud_t3', NULL, 'system', 'invoice.overdue', 'invoice', 'inv_x', '2031-01-12T08:00:00.000Z')",
      ),
    ]);
    const list = (await A(admin, '/audit?entityId=inv_x')).body.data;
    expect(list.items.map((i: any) => i.id)).toEqual(['aud_t3', 'aud_t1']);
    expect(list.financeOnly).toBe(false);
    expect((await A(admin, `/audit?actor=${admin.id}&action=invoice.`)).body.data.items.map((i: any) => i.id)).toEqual([
      'aud_t1',
    ]);
    // 22:30 UTC on 10 Jan is 00:30 on 11 Jan in Harare.
    expect((await A(admin, '/audit?from=2031-01-11&to=2031-01-11')).body.data.items.map((i: any) => i.id)).toEqual([
      'aud_t2',
      'aud_t1',
    ]);

    // Finance-style role: audit.view without users.manage → finance entities only.
    await env.DB.batch([
      q(
        "INSERT OR IGNORE INTO roles (id, key, name, is_system) VALUES ('rol_test_auditor', 'test_auditor', 'Auditor', 0)",
      ),
      q("INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES ('rol_test_auditor', 'audit.view')"),
    ]);
    const auditor = await staff(['test_auditor']);
    const scoped = (await A(auditor, '/audit?from=2031-01-01&to=2031-01-31')).body.data;
    expect(scoped.financeOnly).toBe(true);
    expect(scoped.items.map((i: any) => i.id)).toEqual(['aud_t3', 'aud_t1']);

    const csv = await A(admin, '/audit/export.csv?entityId=inv_x');
    expect(csv.status).toBe(200);
    const lines = String(csv.body).trim().split('\r\n');
    expect(lines[0]).toBe('Time (UTC),Actor,Actor type,Action,Entity type,Entity id,Before,After,IP,Request id');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('invoice.issued');
    expect(lines[1]).toContain('"{""n"":1}"');
    expect(
      await env.DB.prepare("SELECT 1 AS x FROM audit_logs WHERE action = 'audit.exported'").first(),
    ).not.toBeNull();
    const support = await staff(['support_staff']);
    expect((await A(support, '/audit')).status).toBe(403);
    // Full data export is Super Admin only (data.export); Admins are refused.
    expect((await A(admin, '/data-export/staff')).status).toBe(403);
  });

  it('data export service: JSON per module and CSV per table without hashes or tokens', async () => {
    const { exportModuleJson, exportTableCsv } = await import('../../src/server/modules/audit');
    const ctx = ctxWith(ALL_PERMISSIONS);
    await createStaff(['admin']);
    const staffJson = await exportModuleJson(ctx, 'staff');
    expect(Object.keys(staffJson.tables)).toEqual(['users', 'roles', 'role_permissions', 'user_roles']);
    expect(staffJson.tables['users']!.length).toBeGreaterThan(0);
    expect(Object.keys(staffJson.tables['users']![0]!)).not.toContain('password_hash');
    expect(JSON.stringify(staffJson)).not.toMatch(/pbkdf2|\$argon|password_hash/);
    const csv = await exportTableCsv(ctx, 'invoicing', 'invoices');
    expect(csv.split('\r\n')[0]).not.toContain('public_token');
    await expect(exportTableCsv(ctx, 'staff', 'sessions')).rejects.toThrow();
    await expect(exportModuleJson(ctx, 'secrets')).rejects.toThrow();
    await expect(
      exportModuleJson(ctxWith(ALL_PERMISSIONS.filter((p) => p !== 'data.export')), 'staff'),
    ).rejects.toThrow();
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'data.exported'").first<{
        n: number;
      }>(),
    ).toMatchObject({ n: 2 });
  });
});
