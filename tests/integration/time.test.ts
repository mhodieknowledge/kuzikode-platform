import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatMinutes, weekStart } from '../../src/shared/schemas/time';
import { api, login } from '../helpers/api';
import { createClient, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const T = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/time${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
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

/** Tracks own time on projects they belong to; no view-all or billing rights (stricter than Project Manager). */
async function tracker() {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO roles (id, key, name, is_system) VALUES ('rol_test_time_tracker', 'test_time_tracker', 'Time tracker', 0)",
    ),
    ...['dashboard.view', 'projects.view', 'time.track'].map((k) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES ('rol_test_time_tracker', ?)",
      ).bind(k),
    ),
  ]);
  return staff(['test_time_tracker']);
}

/** Bills time and edits invoices, like Finance but without its 2FA requirement; not a project member. */
async function biller() {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO roles (id, key, name, is_system) VALUES ('rol_test_time_biller', 'test_time_biller', 'Time biller', 0)",
    ),
    ...['dashboard.view', 'time.bill', 'invoices.view', 'invoices.create', 'invoices.update'].map((k) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES ('rol_test_time_biller', ?)",
      ).bind(k),
    ),
  ]);
  return staff(['test_time_biller']);
}

let n = 0;
async function project(members: S[], currency: string | null = null) {
  const client = await createClient(`Time Client ${++n}`);
  const id = `prj_time_${n}_${Date.now()}`;
  await env.DB.prepare(
    "INSERT INTO projects (id, reference, client_id, name, status, currency) VALUES (?, ?, ?, ?, 'active', ?)",
  )
    .bind(id, `PRJ-TT-${n}-${Date.now() % 100000}`, client.id, `Website rebuild ${n}`, currency)
    .run();
  for (const m of members)
    await env.DB.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')")
      .bind(id, m.id)
      .run();
  const task = `tsk_time_${n}_${Date.now()}`;
  await env.DB.prepare("INSERT INTO project_tasks (id, project_id, title) VALUES (?, ?, 'Homepage layout')")
    .bind(task, id)
    .run();
  return { id, clientId: client.id, task };
}

const entry = (projectId: string, over: Record<string, unknown> = {}) => ({
  projectId,
  entryDate: '2026-11-02',
  minutes: 90,
  description: 'Layout review',
  billable: true,
  ...over,
});

describe('time tracking (P4.23)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });

  it('entries: default rate and currency, task must belong to the project, people only see their own time', async () => {
    const pm = await tracker();
    const other = await tracker();
    const support = await staff(['support_staff']);
    const p = await project([pm, other]);

    const res = await T(pm, '/entries', entry(p.id, { taskId: p.task }));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const id = res.body.data.id as string;
    expect(await row('SELECT rate_minor, currency, user_id FROM time_entries WHERE id = ?', id)).toEqual({
      rate_minor: 2500,
      currency: 'USD',
      user_id: pm.id,
    });
    expect(
      await row("SELECT 1 AS x FROM audit_logs WHERE action = 'time.entry_created' AND entity_id = ?", id),
    ).not.toBeNull();

    const other2 = await project([pm]);
    expect((await T(pm, '/entries', entry(p.id, { taskId: other2.task }))).status).toBe(422);
    expect((await T(pm, '/entries', entry(p.id, { minutes: 0 }))).status).toBe(422);
    expect((await T(pm, '/entries', entry(p.id, { minutes: 1441 }))).status).toBe(422);
    // Not a member, no projects.view_all: the project is invisible.
    const outsider = await project([]);
    expect((await T(other, '/entries', entry(outsider.id))).status).toBe(404);
    // Support staff can't track time.
    expect((await T(support, '/entries', entry(p.id))).status).toBe(403);

    // Others can't see or change my entry without time.view_all.
    expect((await T(other, '/entries')).body.data.map((e: any) => e.id)).not.toContain(id);
    expect((await T(other, `/entries/${id}`, entry(p.id, { minutes: 10 }), 'PUT')).status).toBe(404);
    expect((await T(other, `/entries/${id}`, undefined, 'DELETE')).status).toBe(404);
    const admin = await staff(['admin']);
    expect((await T(admin, `/entries?userId=${pm.id}`)).body.data.map((e: any) => e.id)).toEqual([id]);

    expect(
      (await T(pm, `/entries/${id}`, entry(p.id, { minutes: 45, billable: false, rateMinor: 4000 }), 'PUT')).status,
    ).toBe(200);
    expect(await row('SELECT minutes, billable, rate_minor FROM time_entries WHERE id = ?', id)).toEqual({
      minutes: 45,
      billable: 0,
      rate_minor: 4000,
    });
    expect((await T(pm, '/entries?billing=non_billable')).body.data).toHaveLength(1);
    expect((await T(pm, `/entries/${id}`, undefined, 'DELETE')).status).toBe(200);
    expect(await row('SELECT 1 AS x FROM time_entries WHERE id = ?', id)).toBeNull();
  });

  it('timer: one at a time, records elapsed minutes (1 minute minimum, 24 hours maximum)', async () => {
    const pm = await tracker();
    const p = await project([pm], 'USD');
    const start = await T(pm, '/timer/start', { projectId: p.id, description: 'Bug fixing' });
    expect(start.status).toBe(201);
    expect((await T(pm, '/timer/start', { projectId: p.id })).status).toBe(409);
    expect((await T(pm, '/timer')).body.data.id).toBe(start.body.data.id);
    // Running timers are not listed as entries and can't be edited.
    expect((await T(pm, '/entries')).body.data).toHaveLength(0);
    expect((await T(pm, `/entries/${start.body.data.id}`, entry(p.id), 'PUT')).status).toBe(409);

    await env.DB.prepare('UPDATE time_entries SET timer_started_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 95 * 60_000).toISOString(), start.body.data.id)
      .run();
    const stop = await T(pm, '/timer/stop', {});
    expect(stop.status).toBe(200);
    expect(stop.body.data.minutes).toBe(95);
    expect((await T(pm, '/timer/stop', {})).status).toBe(409);
    expect((await T(pm, '/timer')).body.data).toBeNull();

    const forgot = await T(pm, '/timer/start', { projectId: p.id });
    await env.DB.prepare('UPDATE time_entries SET timer_started_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 3 * 86_400_000).toISOString(), forgot.body.data.id)
      .run();
    expect((await T(pm, '/timer/stop', {})).body.data.minutes).toBe(1440);

    await T(pm, '/timer/start', { projectId: p.id });
    expect((await T(pm, '/timer/discard', {})).status).toBe(200);
    expect((await T(pm, '/timer')).body.data).toBeNull();
  });

  it('weekly timesheet by project and day; other people’s sheets need time.view_all', async () => {
    const pm = await tracker();
    const p1 = await project([pm]);
    const p2 = await project([pm]);
    await T(pm, '/entries', entry(p1.id, { entryDate: '2026-11-02', minutes: 60 }));
    await T(pm, '/entries', entry(p1.id, { entryDate: '2026-11-02', minutes: 30, billable: false }));
    await T(pm, '/entries', entry(p2.id, { entryDate: '2026-11-04', minutes: 120 }));
    await T(pm, '/entries', entry(p2.id, { entryDate: '2026-11-09', minutes: 999 })); // next week
    const sheet = (await T(pm, '/timesheet?date=2026-11-05')).body.data;
    expect(sheet.week).toBe('2026-11-02');
    expect(sheet.days[6]).toBe('2026-11-08');
    expect(sheet.dayTotals).toEqual([90, 0, 120, 0, 0, 0, 0]);
    expect(sheet.total).toBe(210);
    expect(sheet.billableTotal).toBe(180);
    expect(sheet.rows.find((r: any) => r.projectId === p1.id).minutes[0]).toBe(90);

    // Without time.view_all the userId is ignored and you get your own (empty) sheet; without any time rights, nothing.
    const peer = await tracker();
    expect((await T(peer, `/timesheet?date=2026-11-05&userId=${pm.id}`)).body.data.total).toBe(0);
    const finance = await biller();
    expect((await T(finance, `/timesheet?date=2026-11-05&userId=${pm.id}`)).status).toBe(404);
    const admin = await staff(['admin']);
    expect((await T(admin, `/timesheet?date=2026-11-05&userId=${pm.id}`)).body.data.total).toBe(210);
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('bills unbilled time onto a draft invoice with exact amounts; billed time is locked; deleting the draft releases it', async () => {
    const pm = await tracker();
    const finance = await biller();
    const p = await project([pm]);
    const a = (await T(pm, '/entries', entry(p.id, { entryDate: '2026-11-02', minutes: 90 }))).body.data.id;
    const b = (await T(pm, '/entries', entry(p.id, { entryDate: '2026-11-03', minutes: 20, taskId: p.task }))).body.data
      .id;
    const c = (await T(pm, '/entries', entry(p.id, { minutes: 15, billable: false }))).body.data.id;

    expect((await T(pm, `/projects/${p.id}/bill`, { entryIds: [a, b] })).status).toBe(403); // no time.bill
    const summary = (await T(finance, `/projects/${p.id}`)).body.data;
    expect(summary.unbilled).toEqual([{ currency: 'USD', minutes: 110, amountMinor: 3750 + 833 }]);
    // Non-billable time can't be billed.
    expect((await T(finance, `/projects/${p.id}/bill`, { entryIds: [a, c] })).status).toBe(409);

    const bill = await T(finance, `/projects/${p.id}/bill`, { entryIds: [a, b] });
    expect(bill.status, JSON.stringify(bill.body)).toBe(201);
    const inv = await row(
      'SELECT client_id, status, currency, total_minor, notes FROM invoices WHERE id = ?',
      bill.body.data.invoiceId,
    );
    // 90 min = 1.5 h × $25 = $37.50; 20 min = 0.333 h × $25 = $8.325 → $8.32 (half-even on the line).
    expect(inv).toMatchObject({ client_id: p.clientId, status: 'draft', currency: 'USD', total_minor: 3750 + 832 });
    const items = await all(
      'SELECT id, description, quantity_milli, unit_price_minor, line_total_minor FROM invoice_items WHERE invoice_id = ? ORDER BY position',
      bill.body.data.invoiceId,
    );
    expect(items.map((i) => [i.quantity_milli, i.unit_price_minor, i.line_total_minor])).toEqual([
      [1500, 2500, 3750],
      [333, 2500, 832],
    ]);
    expect(items[1].description).toContain('Homepage layout');
    const links = await all(
      'SELECT id, invoice_id, invoice_item_id FROM time_entries WHERE id IN (?, ?) ORDER BY entry_date',
      a,
      b,
    );
    expect(links).toEqual([
      { id: a, invoice_id: bill.body.data.invoiceId, invoice_item_id: items[0].id },
      { id: b, invoice_id: bill.body.data.invoiceId, invoice_item_id: items[1].id },
    ]);
    expect(
      await row("SELECT after FROM audit_logs WHERE action = 'time.billed' AND entity_id = ?", p.id),
    ).not.toBeNull();

    // Billed time is locked and can't be billed twice.
    expect((await T(pm, `/entries/${a}`, entry(p.id), 'PUT')).status).toBe(409);
    expect((await T(pm, `/entries/${a}`, undefined, 'DELETE')).status).toBe(409);
    expect((await T(finance, `/projects/${p.id}/bill`, { entryIds: [a] })).status).toBe(409);

    // Editing the draft keeps the time billed to it; deleting the draft releases it.
    const invApi = (path: string, body?: unknown, method?: string) =>
      api(`/api/v1/admin/invoices${path}`, {
        cookie: finance.cookie,
        csrf: finance.csrf,
        body,
        ...(method ? { method } : {}),
      });
    const draft = (await invApi(`/${bill.body.data.invoiceId}`)).body.data;
    const put = await invApi(
      `/${bill.body.data.invoiceId}`,
      {
        clientId: p.clientId,
        currency: 'USD',
        discountType: 'none',
        discountValue: 0,
        items: [
          {
            description: 'Website work (time)',
            quantity: '1.833',
            unitPriceMinor: 2500,
            discountType: 'none',
            discountValue: 0,
          },
        ],
      },
      'PUT',
    );
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(draft).toBeTruthy();
    expect(await all('SELECT invoice_id, invoice_item_id FROM time_entries WHERE id IN (?, ?)', a, b)).toEqual([
      { invoice_id: bill.body.data.invoiceId, invoice_item_id: null },
      { invoice_id: bill.body.data.invoiceId, invoice_item_id: null },
    ]);
    expect((await invApi(`/${bill.body.data.invoiceId}`, undefined, 'DELETE')).status).toBe(200);
    expect(await all('SELECT invoice_id FROM time_entries WHERE id IN (?, ?)', a, b)).toEqual([
      { invoice_id: null },
      { invoice_id: null },
    ]);
    expect((await T(finance, `/projects/${p.id}/bill`, { entryIds: [a, b] })).status).toBe(201);
  });

  it('concurrent billing of the same time creates exactly one invoice', async () => {
    const pm = await staff(['project_manager']);
    const f1 = await biller();
    const f2 = await staff(['admin']);
    const p = await project([pm]);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await T(pm, '/entries', entry(p.id, { minutes: 30 + i }))).body.data.id);
    const before = (await row('SELECT COUNT(*) AS n FROM invoices WHERE client_id = ?', p.clientId)).n;
    const results = await Promise.all([
      T(f1, `/projects/${p.id}/bill`, { entryIds: ids }),
      T(f2, `/projects/${p.id}/bill`, { entryIds: ids }),
      T(f1, `/projects/${p.id}/bill`, { entryIds: [ids[0]] }),
      T(f2, `/projects/${p.id}/bill`, { entryIds: [ids[2], ids[1]] }),
    ]);
    const created = results.filter((r) => r.status === 201);
    expect(
      results.map((r) => r.status).every((st) => st === 201 || st === 409),
      JSON.stringify(results.map((r) => [r.status, r.body])),
    ).toBe(true);
    expect(created.length).toBeGreaterThanOrEqual(1);
    const invoices = await all('SELECT id FROM invoices WHERE client_id = ?', p.clientId);
    expect(invoices.length - before).toBe(created.length);
    // Every entry is billed exactly once, and each invoice only carries lines for entries linked to it.
    const links = await all('SELECT invoice_id FROM time_entries WHERE id IN (?, ?, ?)', ...ids);
    expect(links.every((l) => l.invoice_id)).toBe(true);
    for (const inv of created) {
      const lines = (await row('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id = ?', inv.body.data.invoiceId))
        .n;
      const linked = (await row('SELECT COUNT(*) AS n FROM time_entries WHERE invoice_id = ?', inv.body.data.invoiceId))
        .n;
      expect(lines).toBe(linked);
    }
    // No orphan drafts: a losing batch leaves nothing behind.
    const orphan = await row(
      `SELECT COUNT(*) AS n FROM invoices i WHERE i.client_id = ? AND NOT EXISTS (SELECT 1 FROM time_entries e WHERE e.invoice_id = i.id)`,
      p.clientId,
    );
    expect(orphan.n).toBe(0);
  });
});
