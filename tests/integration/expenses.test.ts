import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { csvCell } from '../../src/server/modules/expenses';
import { ORIGIN, api, login } from '../helpers/api';
import { createClient, createStaff } from '../helpers/factories';
import { pdf } from '../helpers/file-fixtures';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return login('admin', u.email, u.password);
}
type S = Awaited<ReturnType<typeof staff>>;
const E = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/expenses${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const base = {
  categoryId: 'exc_hosting',
  expenseDate: '2031-03-05',
  description: 'VPS hosting',
  amountMinor: 2_500,
  currency: 'USD',
};

describe('expenses (P4.13)', () => {
  beforeEach(() => seedBase());

  it('records, edits and voids expenses; voids leave totals and cannot be edited', async () => {
    const s = await staff(['admin']);
    const client = await createClient();
    const proj = await api('/api/v1/admin/projects', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { clientId: client.id, name: 'Site' },
    });
    const projectId = proj.body.data.id as string;

    const a = await E(s, '', { ...base, vendor: 'Contabo', paymentMethod: 'card', projectId });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    const row = await env.DB.prepare('SELECT * FROM expenses WHERE id = ?').bind(a.body.data.id).first<any>();
    expect(row).toMatchObject({ client_id: client.id, status: 'recorded', amount_minor: 2_500 }); // project implies client

    const other = await createClient('Other (Pvt) Ltd');
    expect((await E(s, '', { ...base, projectId, clientId: other.id })).status).toBe(422);
    expect((await E(s, '', { ...base, amountMinor: 0 })).status).toBe(422);
    await env.DB.prepare("UPDATE expense_categories SET active = 0 WHERE id = 'exc_software'").run();
    expect((await E(s, '', { ...base, categoryId: 'exc_software' })).status).toBe(422);
    await env.DB.prepare("UPDATE expense_categories SET active = 1 WHERE id = 'exc_software'").run();

    const b = await E(s, '', { ...base, description: 'Domain renewal', amountMinor: 1_500, expenseDate: '2031-03-20' });
    expect(
      (
        await E(
          s,
          `/${b.body.data.id}`,
          { ...base, description: 'Domain renewal (2 years)', amountMinor: 3_000, expenseDate: '2031-03-20' },
          'PUT',
        )
      ).status,
    ).toBe(200);
    const range = '?from=2031-03-01&to=2031-03-31';
    const list = await E(s, range);
    expect(list.body.data.totals).toEqual([{ currency: 'USD', total: 5_500, n: 2 }]);

    expect((await E(s, `/${b.body.data.id}/void`, { reason: 'Duplicate entry' })).status).toBe(200);
    expect((await E(s, `/${b.body.data.id}/void`, { reason: 'Again' })).status).toBe(409);
    expect((await E(s, `/${b.body.data.id}`, base, 'PUT')).status).toBe(409);
    expect((await E(s, range)).body.data.totals).toEqual([{ currency: 'USD', total: 2_500, n: 1 }]);
    expect((await E(s, `${range}&status=void`)).body.data.items).toHaveLength(1);
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'expense' AND entity_id = ?")
          .bind(b.body.data.id)
          .first<any>()
      ).n,
    ).toBe(3);
  });

  it('reports by category and month, and exports a safe CSV with the disclaimer', async () => {
    const s = await staff(['admin']);
    const office = (await E(s, '/categories', { name: `Office ${Date.now()}` })).body.data.id as string;
    await E(s, '', { ...base, expenseDate: '2032-01-10', amountMinor: 1_000 });
    await E(s, '', { ...base, expenseDate: '2032-02-10', amountMinor: 2_000 });
    await E(s, '', {
      ...base,
      expenseDate: '2032-02-15',
      amountMinor: 700,
      categoryId: office,
      description: '=HYPERLINK("http://evil")',
    });
    const r = await E(s, '/report?from=2032-01-01&to=2032-12-31');
    expect(r.status).toBe(200);
    expect(r.body.data.totals).toEqual([{ currency: 'USD', total: 3_700, n: 3 }]);
    expect(r.body.data.byMonth).toEqual([
      { month: '2032-02', currency: 'USD', total: 2_700, n: 2 },
      { month: '2032-01', currency: 'USD', total: 1_000, n: 1 },
    ]);
    expect(r.body.data.byCategory.map((c: any) => [c.category, c.total])).toEqual([
      ['Hosting & cloud', 3_000],
      [expect.stringMatching(/^Office /), 700],
    ]);

    const res = await exports.default.fetch(
      `${ORIGIN}/api/v1/admin/expenses/export.csv?from=2032-01-01&to=2032-12-31`,
      {
        headers: { cookie: s.cookie },
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const lines = (await res.text()).trim().split('\r\n');
    expect(lines[0]).toBe('Expense records. This is not a statutory accounting system.');
    expect(lines[1]).toMatch(/^Date,Category,Vendor,Description,Amount,Currency/);
    expect(lines).toHaveLength(5);
    expect(lines.some((l) => l.includes(`"'=HYPERLINK(""http://evil"")"`))).toBe(true);
    expect(lines.some((l) => l.includes(',20.00,USD,'))).toBe(true);
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(null)).toBe('');
  });

  it('manages categories (used ones only deactivate), attaches receipts and enforces permissions', async () => {
    const s = await staff(['admin']);
    const cat = await E(s, '/categories', { name: 'Travel', description: 'Trips to clients' });
    expect(cat.status).toBe(201);
    expect((await E(s, '/categories', { name: 'travel' })).status).toBe(422);
    const ex = await E(s, '', { ...base, categoryId: cat.body.data.id });
    expect((await E(s, `/categories/${cat.body.data.id}`, undefined, 'DELETE')).status).toBe(409);
    expect((await E(s, `/categories/${cat.body.data.id}`, { name: 'Travel', active: false }, 'PUT')).status).toBe(200);
    const unused = await E(s, '/categories', { name: 'Unused' });
    expect((await E(s, `/categories/${unused.body.data.id}`, undefined, 'DELETE')).status).toBe(200);

    const form = new FormData();
    form.set('file', new File([pdf()], 'receipt.pdf', { type: 'application/pdf' }));
    const up = await exports.default.fetch(`${ORIGIN}/api/v1/admin/expenses/${ex.body.data.id}/receipt`, {
      method: 'POST',
      headers: { cookie: s.cookie, 'x-csrf-token': s.csrf, origin: ORIGIN },
      body: form,
    });
    expect(up.status).toBe(201);
    const fileId = ((await up.json()) as any).data.fileId as string;
    expect(
      (await exports.default.fetch(`${ORIGIN}/api/v1/admin/files/${fileId}`, { headers: { cookie: s.cookie } })).status,
    ).toBe(200);

    const pm = await staff(['project_manager']);
    expect((await E(pm, '')).status).toBe(403);
    expect(
      (await exports.default.fetch(`${ORIGIN}/api/v1/admin/files/${fileId}`, { headers: { cookie: pm.cookie } }))
        .status,
    ).toBe(404);
  });
});
