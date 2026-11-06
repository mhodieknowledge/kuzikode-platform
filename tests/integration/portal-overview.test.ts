import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, login } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';

const u = () => Math.random().toString(36).slice(2, 10);
const run = (sql: string, ...params: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...params)
    .run();

async function invoice(client: string, currency: string, status: string, total: number, balance: number, due: string) {
  const id = `inv_${u()}`;
  await run(
    `INSERT INTO invoices (id, number, client_id, currency, status, issue_date, due_date, total_minor, amount_paid_minor, balance_minor, issued_at)
     VALUES (?, ?, ?, ?, ?, '2026-01-05', ?, ?, ?, ?, ?)`,
    id,
    status === 'draft' ? null : `INV-${id}`,
    client,
    currency,
    status,
    due,
    total,
    total - balance,
    balance,
    status === 'draft' ? null : '2026-01-05T08:00:00.000Z',
  );
  return id;
}

async function quotation(client: string, status: string, validUntil: string | null, total = 50_000) {
  const id = `quo_${u()}`;
  await run(
    `INSERT INTO quotations (id, number, client_id, title, currency, status, valid_until, total_minor, sent_at)
     VALUES (?, ?, ?, ?, 'USD', ?, ?, ?, ?)`,
    id,
    status === 'draft' ? null : `QUO-${id}`,
    client,
    `Proposal ${id}`,
    status,
    validUntil,
    total,
    status === 'draft' ? null : '2026-02-01T08:00:00.000Z',
  );
  return id;
}

async function project(client: string, status: string, name = `Project ${u()}`) {
  const id = `prj_${u()}`;
  await run(
    'INSERT INTO projects (id, reference, client_id, name, status, progress_pct) VALUES (?, ?, ?, ?, ?, 40)',
    id,
    `PRJ-${id}`,
    client,
    name,
    status,
  );
  return id;
}

async function overview(cookie: string) {
  const res = await api('/api/v1/portal/overview', { cookie });
  expect(res.status).toBe(200);
  return res.body.data;
}

describe('portal overview (P5.2)', () => {
  it('sums open balances per currency (overdue split out), lists open quotations and active projects, own clients only', async () => {
    const mine = await createClient('Mine (Pvt) Ltd');
    const other = await createClient('Other (Pvt) Ltd');
    // Mine: USD 1000.00 + 250.00 open (the second overdue by date), ZWG 300.00 overdue by status; paid/draft/void excluded.
    await invoice(mine.id, 'USD', 'issued', 100_000, 100_000, '2999-01-01');
    await invoice(mine.id, 'USD', 'partially_paid', 50_000, 25_000, '2000-01-01');
    await invoice(mine.id, 'ZWG', 'overdue', 30_000, 30_000, '2999-01-01');
    await invoice(mine.id, 'USD', 'paid', 70_000, 0, '2000-01-01');
    await invoice(mine.id, 'USD', 'draft', 90_000, 90_000, '2000-01-01');
    await invoice(mine.id, 'USD', 'void', 80_000, 80_000, '2000-01-01');
    // Other client's invoices never count.
    await invoice(other.id, 'USD', 'issued', 999_900, 999_900, '2000-01-01');

    const openQ = await quotation(mine.id, 'sent', '2999-12-31');
    const viewedQ = await quotation(mine.id, 'viewed', null);
    await quotation(mine.id, 'sent', '2000-01-01'); // expired by date
    await quotation(mine.id, 'draft', '2999-12-31');
    await quotation(mine.id, 'accepted', '2999-12-31');
    await quotation(other.id, 'sent', '2999-12-31');

    const active = await project(mine.id, 'active', 'Shop website');
    await project(mine.id, 'completed');
    await project(other.id, 'active');
    await run(
      "INSERT INTO project_milestones (id, project_id, title, due_date, status, client_visible) VALUES (?, ?, 'Internal review', '2026-03-01', 'pending', 0)",
      `mil_${u()}`,
      active,
    );
    await run(
      "INSERT INTO project_milestones (id, project_id, title, due_date, status, client_visible) VALUES (?, ?, 'Design sign-off', '2026-03-10', 'pending', 1)",
      `mil_${u()}`,
      active,
    );

    const user = await createPortalUser([mine.id]);
    const s = await login('portal', user.email, user.password);
    const data = await overview(s.cookie);

    expect(data.areas).toEqual({ finance: true, projects: true, quotations: true });
    expect(data.balances).toEqual([
      { currency: 'USD', outstandingMinor: 125_000, overdueMinor: 25_000, openInvoices: 2, overdueInvoices: 1 },
      { currency: 'ZWG', outstandingMinor: 30_000, overdueMinor: 30_000, openInvoices: 1, overdueInvoices: 1 },
    ]);
    expect(data.quotations.total).toBe(2);
    expect(data.quotations.items.map((q: { id: string }) => q.id).sort()).toEqual([openQ, viewedQ].sort());
    expect(data.projects.total).toBe(1);
    expect(data.projects.items[0]).toMatchObject({
      id: active,
      name: 'Shop website',
      status: 'active',
      progressPct: 40,
      nextMilestone: { title: 'Design sign-off', dueDate: '2026-03-10' },
    });
    const ids = JSON.stringify(data);
    expect(ids).not.toContain(other.id);
    expect(ids).not.toContain('Internal review');
  });

  it('recent activity shows client-facing events only, newest first', async () => {
    const c = await createClient();
    const prj = await project(c.id, 'active', 'Mobile app');
    await invoice(c.id, 'USD', 'issued', 10_000, 10_000, '2999-01-01');
    await run(
      `INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, status)
       VALUES (?, 'RCT-OVW-1', ?, 'manual', 'bank_transfer', 5000, 'USD', '2026-03-01T09:00:00.000Z', 'completed')`,
      `pay_${u()}`,
      c.id,
    );
    await run(
      `INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, status)
       VALUES (?, 'RCT-OVW-REV', ?, 'manual', 'bank_transfer', 7000, 'USD', '2026-03-02T09:00:00.000Z', 'reversed')`,
      `pay_${u()}`,
      c.id,
    );
    const staff = await createStaff(['admin']);
    await run(
      "INSERT INTO project_updates (id, project_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, 'Login screens are ready for review.', 'client', '2026-03-05T09:00:00.000Z')",
      `pup_${u()}`,
      prj,
      staff.id,
    );
    await run(
      "INSERT INTO project_updates (id, project_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, 'Budget is tight, keep it quiet.', 'internal', '2026-03-06T09:00:00.000Z')",
      `pup_${u()}`,
      prj,
      staff.id,
    );
    await quotation(c.id, 'draft', null);

    const user = await createPortalUser([c.id]);
    const s = await login('portal', user.email, user.password);
    const { activity } = await overview(s.cookie);
    expect(activity.map((a: { kind: string }) => a.kind)).toEqual(['project_update', 'payment', 'invoice']);
    expect(activity[0]).toMatchObject({ title: 'Update on Mobile app', detail: 'Login screens are ready for review.' });
    expect(activity[1]).toMatchObject({ amountMinor: 5000, currency: 'USD' });
    expect(JSON.stringify(activity)).not.toContain('keep it quiet');
    expect(JSON.stringify(activity)).not.toContain('RCT-OVW-REV');
  });

  it('access roles: billing contacts see money, members see projects, nobody sees another client', async () => {
    const c = await createClient();
    await invoice(c.id, 'USD', 'issued', 10_000, 10_000, '2999-01-01');
    await project(c.id, 'active', 'Intranet');
    await quotation(c.id, 'sent', null);
    const billing = await createPortalUser([c.id], { role: 'billing' });
    const member = await createPortalUser([c.id], { role: 'member' });

    const b = await overview((await login('portal', billing.email, billing.password)).cookie);
    expect(b.areas).toEqual({ finance: true, projects: false, quotations: true });
    expect(b.balances).toHaveLength(1);
    expect(b.projects).toEqual({ total: 0, items: [] });

    const m = await overview((await login('portal', member.email, member.password)).cookie);
    expect(m.areas).toEqual({ finance: false, projects: true, quotations: true });
    expect(m.balances).toEqual([]);
    expect(m.projects.total).toBe(1);
    expect(m.activity.map((a: { kind: string }) => a.kind)).not.toContain('invoice');
    expect(m.quotations.total).toBe(1);
  });

  it('portal file downloads follow the same areas: invoice files are not for "member" contacts', async () => {
    const c = await createClient();
    const inv = await invoice(c.id, 'USD', 'issued', 10_000, 10_000, '2999-01-01');
    const fileId = `fil_${u()}`;
    const key = `test/${fileId}.pdf`;
    await env.FILES.put(key, '%PDF-1.4 test');
    await run(
      `INSERT INTO files (id, r2_key, original_name, mime_type, size_bytes, sha256, owner_type, owner_id)
       VALUES (?, ?, 'invoice.pdf', 'application/pdf', 13, 'x', 'invoice', ?)`,
      fileId,
      key,
      inv,
    );
    const billing = await createPortalUser([c.id], { role: 'billing' });
    const member = await createPortalUser([c.id], { role: 'member' });
    const b = await login('portal', billing.email, billing.password);
    const m = await login('portal', member.email, member.password);
    expect((await api(`/api/v1/portal/files/${fileId}`, { cookie: b.cookie })).status).toBe(200);
    expect((await api(`/api/v1/portal/files/${fileId}`, { cookie: m.cookie })).status).toBe(404);
  });

  it('an unlinked account gets an empty overview; staff sessions and anonymous callers are refused', async () => {
    const lonely = await createPortalUser([]);
    const data = await overview((await login('portal', lonely.email, lonely.password)).cookie);
    expect(data).toEqual({
      areas: { finance: false, projects: false, quotations: false },
      balances: [],
      quotations: { total: 0, items: [] },
      projects: { total: 0, items: [] },
      activity: [],
    });
    const staff = await createStaff(['admin']);
    const admin = await login('admin', staff.email, staff.password);
    expect((await api('/api/v1/portal/overview', { cookie: admin.cookie })).status).toBe(401);
    expect((await api('/api/v1/portal/overview')).status).toBe(401);
  });
});
