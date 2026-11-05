import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { notifyUser } from '../../src/server/modules/notifications';
import { api, login } from '../helpers/api';
import { createClient, createStaff } from '../helpers/factories';

describe('admin shell APIs (P4.1)', () => {
  it('search is scoped by permission: support sees clients and only their own projects, not invoices', async () => {
    const client = await createClient('Zambezi Freight Search Test');
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO invoices (id, number, client_id, currency, status, issue_date, due_date) VALUES ('inv_srch', 'INV-SRCH-0001', ?, 'USD', 'issued', '2026-11-01', '2026-11-15')",
      ).bind(client.id),
      env.DB.prepare(
        "INSERT INTO projects (id, reference, client_id, name) VALUES ('prj_srch_a', 'PRJ-SRCH-A', ?, 'Zambezi portal')",
      ).bind(client.id),
      env.DB.prepare(
        "INSERT INTO projects (id, reference, client_id, name) VALUES ('prj_srch_b', 'PRJ-SRCH-B', ?, 'Zambezi app')",
      ).bind(client.id),
    ]);
    const admin = await createStaff(['admin']);
    const support = await createStaff(['support_staff']);
    await env.DB.prepare("INSERT INTO project_members (project_id, user_id) VALUES ('prj_srch_a', ?)")
      .bind(support.id)
      .run();

    const a = await login('admin', admin.email, admin.password);
    const all = await api('/api/v1/admin/search?q=Zambezi', { cookie: a.cookie });
    expect(all.status).toBe(200);
    const kinds = all.body.data.map((r: any) => `${r.kind}:${r.id}`);
    expect(kinds).toEqual(
      expect.arrayContaining([`client:${client.id}`, 'invoice:inv_srch', 'project:prj_srch_a', 'project:prj_srch_b']),
    );
    expect((await api('/api/v1/admin/search?q=INV-SRCH', { cookie: a.cookie })).body.data[0]).toMatchObject({
      kind: 'invoice',
      title: 'INV-SRCH-0001',
      href: '/admin/invoices/inv_srch',
    });

    const s = await login('admin', support.email, support.password);
    const scoped = (await api('/api/v1/admin/search?q=Zambezi', { cookie: s.cookie })).body.data.map(
      (r: any) => `${r.kind}:${r.id}`,
    );
    expect(scoped).toContain(`client:${client.id}`);
    expect(scoped).toContain('project:prj_srch_a');
    expect(scoped).not.toContain('project:prj_srch_b');
    expect(scoped.some((k: string) => k.startsWith('invoice:'))).toBe(false);

    // Wildcards are literal, short queries return nothing.
    expect((await api('/api/v1/admin/search?q=%25%25', { cookie: a.cookie })).body.data).toEqual([]);
    expect((await api('/api/v1/admin/search?q=Z', { cookie: a.cookie })).body.data).toEqual([]);
  });

  it('requires a staff session; portal sessions are not accepted', async () => {
    expect((await api('/api/v1/admin/search?q=abc')).status).toBe(401);
    expect((await api('/api/v1/admin/notifications')).status).toBe(401);
  });

  it('notifications: list own only, unread count, mark selected and all as read', async () => {
    const me = await createStaff(['support_staff']);
    const other = await createStaff(['support_staff']);
    const ctx = createContext({ env });
    await env.DB.batch([
      notifyUser(ctx, me.id, { type: 'test', title: 'First', link: '/admin/enquiries/enq_1' }),
      notifyUser(ctx, me.id, { type: 'test', title: 'Second', link: 'https://evil.example/' }),
      notifyUser(ctx, other.id, { type: 'test', title: 'Not mine' }),
    ]);
    const s = await login('admin', me.email, me.password);
    const list = await api('/api/v1/admin/notifications', { cookie: s.cookie });
    expect(list.body.data.unread).toBe(2);
    expect(list.body.data.items.map((i: any) => i.title).sort()).toEqual(['First', 'Second']);
    expect(list.body.data.items.find((i: any) => i.title === 'Second').link).toBeNull();
    const firstId = list.body.data.items.find((i: any) => i.title === 'First').id;

    const otherList = await api('/api/v1/admin/notifications', {
      cookie: (await login('admin', other.email, other.password)).cookie,
    });
    const otherId = otherList.body.data.items[0].id;
    // Marking someone else's notification does nothing.
    const cross = await api('/api/v1/admin/notifications/read', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { ids: [otherId] },
    });
    expect(cross.body.data.updated).toBe(0);

    expect(
      (await api('/api/v1/admin/notifications/read', { cookie: s.cookie, csrf: s.csrf, body: { ids: [firstId] } })).body
        .data.updated,
    ).toBe(1);
    expect(
      (await api('/api/v1/admin/notifications?unread=1', { cookie: s.cookie })).body.data.items.map(
        (i: any) => i.title,
      ),
    ).toEqual(['Second']);
    expect(
      (await api('/api/v1/admin/notifications/read', { cookie: s.cookie, csrf: s.csrf, body: {} })).body.data.updated,
    ).toBe(1);
    expect((await api('/api/v1/admin/notifications', { cookie: s.cookie })).body.data.unread).toBe(0);
    // CSRF token required for the write.
    expect((await api('/api/v1/admin/notifications/read', { cookie: s.cookie, body: {} })).status).toBe(403);
  });
});
