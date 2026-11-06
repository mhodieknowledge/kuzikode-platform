import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';

const base = (over: Record<string, unknown> = {}) => ({
  type: 'business',
  displayName: 'Mopani Logistics',
  email: 'Accounts@Mopani.example',
  defaultCurrency: 'USD',
  paymentTermsDays: 14,
  tags: ['logistics', 'priority'],
  billingAddress: { line1: '12 Example Road', city: 'Harare', country: 'Zimbabwe' },
  ...over,
});

async function session(roles: string[]) {
  const u = await createStaff(roles);
  return login('admin', u.email, u.password);
}

describe('clients admin (P4.4)', () => {
  it('creates a client with a gap-free number and primary contact; lists, filters and updates it with audit rows', async () => {
    const s = await session(['admin']);
    const created = await api('/api/v1/admin/clients', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { ...base(), primaryContact: { name: 'Rumbi Moyo', email: 'rumbi@mopani.example', isBilling: true } },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.number).toMatch(/^CL-\d{4,}$/);
    const id = created.body.data.id;
    const second = await api('/api/v1/admin/clients', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: base({ displayName: 'Second Co' }),
    });
    const n1 = Number(created.body.data.number.replace(/\D/g, ''));
    expect(Number(second.body.data.number.replace(/\D/g, ''))).toBe(n1 + 1);

    const detail = await api(`/api/v1/admin/clients/${id}`, { cookie: s.cookie });
    expect(detail.body.data.client).toMatchObject({
      email: 'accounts@mopani.example',
      tags: ['logistics', 'priority'],
      billingAddress: { city: 'Harare' },
    });
    expect(detail.body.data.contacts).toEqual([
      expect.objectContaining({ name: 'Rumbi Moyo', isPrimary: true, isBilling: true }),
    ]);

    const list = await api('/api/v1/admin/clients?q=Mopani&tag=logistics', { cookie: s.cookie });
    expect(list.body.data.items.map((c: any) => c.id)).toContain(id);
    expect(list.body.data.items.find((c: any) => c.id === id).primaryContact).toBe('Rumbi Moyo');
    expect((await api('/api/v1/admin/clients?q=%25', { cookie: s.cookie })).body.data.items.length).toBe(0);

    const upd = await api(`/api/v1/admin/clients/${id}`, {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: base({ displayName: 'Mopani Logistics (Pvt) Ltd' }),
    });
    expect(upd.status).toBe(200);
    const audits = await env.DB.prepare(
      "SELECT action FROM audit_logs WHERE entity_type = 'client' AND entity_id = ? ORDER BY created_at",
    )
      .bind(id)
      .all<any>();
    expect(audits.results.map((a: any) => a.action)).toEqual(['client.created', 'client.updated']);
    expect(
      (await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ defaultCurrency: 'EUR' }) }))
        .status,
    ).toBe(422);
    expect(
      (await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ tags: ['<script>'] }) }))
        .status,
    ).toBe(422);
  });

  it('contacts: one primary at a time; contacts on documents cannot be removed', async () => {
    const s = await session(['admin']);
    const { id } = (
      await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ displayName: 'Contacts Co' }) })
    ).body.data;
    const a = (
      await api(`/api/v1/admin/clients/${id}/contacts`, {
        cookie: s.cookie,
        csrf: s.csrf,
        body: { name: 'A', isPrimary: true },
      })
    ).body.data.id;
    const b = (
      await api(`/api/v1/admin/clients/${id}/contacts`, {
        cookie: s.cookie,
        csrf: s.csrf,
        body: { name: 'B', isPrimary: true },
      })
    ).body.data.id;
    const contacts = (await api(`/api/v1/admin/clients/${id}`, { cookie: s.cookie })).body.data.contacts;
    expect(contacts.filter((c: any) => c.isPrimary).map((c: any) => c.id)).toEqual([b]);
    await env.DB.prepare(
      "INSERT INTO quotations (id, client_id, contact_id, title, currency) VALUES ('quo_contact_t', ?, ?, 'Q', 'USD')",
    )
      .bind(id, a)
      .run();
    expect(
      (await api(`/api/v1/admin/clients/${id}/contacts/${a}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf }))
        .status,
    ).toBe(409);
    expect(
      (await api(`/api/v1/admin/clients/${id}/contacts/${b}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf }))
        .status,
    ).toBe(200);
    // A contact id from another client is not found.
    const other = (
      await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ displayName: 'Other Co' }) })
    ).body.data.id;
    expect(
      (await api(`/api/v1/admin/clients/${other}/contacts/${a}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf }))
        .status,
    ).toBe(404);
  });

  it('notes, archive/restore, delete only when unused; permissions per role', async () => {
    const s = await session(['admin']);
    const { id } = (
      await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ displayName: 'Archive Co' }) })
    ).body.data;
    expect(
      (
        await api(`/api/v1/admin/clients/${id}/notes`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { body: 'Prefers EcoCash.' },
        })
      ).status,
    ).toBe(201);
    expect(
      (await api(`/api/v1/admin/clients/${id}/archive`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(200);
    expect(
      (await api(`/api/v1/admin/clients/${id}/archive`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(409);
    expect((await api('/api/v1/admin/clients?q=Archive%20Co', { cookie: s.cookie })).body.data.items).toHaveLength(0);
    expect(
      (await api('/api/v1/admin/clients?q=Archive%20Co&status=archived', { cookie: s.cookie })).body.data.items,
    ).toHaveLength(1);
    expect(
      (await api(`/api/v1/admin/clients/${id}/restore`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(200);
    const restored = (await api(`/api/v1/admin/clients/${id}`, { cookie: s.cookie })).body.data;
    expect(restored.client.status).toBe('active');
    expect(restored.notes[0].body).toBe('Prefers EcoCash.');
    expect(
      (await api(`/api/v1/admin/clients/${id}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf })).status,
    ).toBe(200);
    expect((await api(`/api/v1/admin/clients/${id}`, { cookie: s.cookie })).status).toBe(404);

    const used = (
      await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ displayName: 'Used Co' }) })
    ).body.data.id;
    await env.DB.prepare("INSERT INTO invoices (id, client_id, currency) VALUES ('inv_used_client', ?, 'USD')")
      .bind(used)
      .run();
    expect(
      (await api(`/api/v1/admin/clients/${used}`, { method: 'DELETE', cookie: s.cookie, csrf: s.csrf })).status,
    ).toBe(409);

    const support = await session(['support_staff']);
    expect((await api(`/api/v1/admin/clients/${used}`, { cookie: support.cookie })).status).toBe(200);
    expect(
      (await api('/api/v1/admin/clients', { cookie: support.cookie, csrf: support.csrf, body: base() })).status,
    ).toBe(403);
    expect(
      (
        await api(`/api/v1/admin/clients/${used}/notes`, {
          cookie: support.cookie,
          csrf: support.csrf,
          body: { body: 'x' },
        })
      ).status,
    ).toBe(403);
    const pm = await session(['content_manager']);
    expect((await api('/api/v1/admin/clients', { cookie: pm.cookie })).status).toBe(403);
  });

  it('credit balance per currency comes from the credit ledger', async () => {
    const s = await session(['admin']);
    const { id } = (
      await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ displayName: 'Credit Co' }) })
    ).body.data;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO client_credits (id, client_id, currency, amount_minor, source_type) VALUES ('ccr_t1', ?, 'USD', 5000, 'overpayment')",
      ).bind(id),
      env.DB.prepare(
        "INSERT INTO client_credits (id, client_id, currency, amount_minor, source_type) VALUES ('ccr_t2', ?, 'USD', -2000, 'applied')",
      ).bind(id),
      env.DB.prepare(
        "INSERT INTO client_credits (id, client_id, currency, amount_minor, source_type) VALUES ('ccr_t3', ?, 'ZWG', 100, 'adjustment')",
      ).bind(id),
    ]);
    expect((await api(`/api/v1/admin/clients/${id}`, { cookie: s.cookie })).body.data.credits).toEqual([
      { currency: 'USD', balance: 3000 },
      { currency: 'ZWG', balance: 100 },
    ]);
  });

  it('portal access: invite a contact, accept, then revoke; pending links need an active account to approve', async () => {
    const s = await session(['admin']);
    const { id } = (
      await api('/api/v1/admin/clients', { cookie: s.cookie, csrf: s.csrf, body: base({ displayName: 'Portal Co' }) })
    ).body.data;
    const email = `portal-${Date.now()}@example.com`;
    const noEmail = (
      await api(`/api/v1/admin/clients/${id}/contacts`, { cookie: s.cookie, csrf: s.csrf, body: { name: 'No Email' } })
    ).body.data.id;
    expect(
      (
        await api(`/api/v1/admin/clients/${id}/portal/invitations`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { contactId: noEmail },
        })
      ).status,
    ).toBe(422);
    const contactId = (
      await api(`/api/v1/admin/clients/${id}/contacts`, {
        cookie: s.cookie,
        csrf: s.csrf,
        body: { name: 'Portal Person', email },
      })
    ).body.data.id;
    const inv = await api(`/api/v1/admin/clients/${id}/portal/invitations`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { contactId, role: 'billing' },
    });
    expect(inv.status).toBe(201);
    let access = (await api(`/api/v1/admin/clients/${id}`, { cookie: s.cookie })).body.data.access;
    expect(access).toEqual([
      expect.objectContaining({ email, role: 'billing', status: 'pending', user_status: 'invited' }),
    ]);
    const accessId = access[0].id;
    // Pending invitee without an account yet can't be approved.
    expect(
      (
        await api(`/api/v1/admin/clients/${id}/portal/access/${accessId}`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { action: 'approve' },
        })
      ).status,
    ).toBe(409);
    const mail = await env.DB.prepare(
      "SELECT json_extract(payload,'$.data.link') link FROM outbox WHERE json_extract(payload,'$.template') = 'client_invitation' AND json_extract(payload,'$.to') = ?",
    )
      .bind(email)
      .first<{ link: string }>();
    const token = new URL(mail!.link).searchParams.get('token');
    expect(
      (await api('/api/v1/auth/invitations/accept', { body: { token, password: 'A-long-portal-passphrase-1' } }))
        .status,
    ).toBe(200);
    access = (await api(`/api/v1/admin/clients/${id}`, { cookie: s.cookie })).body.data.access;
    expect(access[0].status).toBe('active');
    const portal = await login('portal', email, 'A-long-portal-passphrase-1');
    expect((await api('/api/v1/auth/portal/me', { cookie: portal.cookie })).body.data.clientIds).toEqual([id]);
    expect(
      (
        await api(`/api/v1/admin/clients/${id}/portal/invitations`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { contactId },
        })
      ).status,
    ).toBe(409);

    expect(
      (
        await api(`/api/v1/admin/clients/${id}/portal/access/${accessId}`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { action: 'revoke' },
        })
      ).status,
    ).toBe(200);
    expect((await api('/api/v1/auth/portal/me', { cookie: portal.cookie })).body.data.clientIds).toEqual([]);
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) n FROM audit_logs WHERE action = 'client.portal_revoked' AND entity_id = ?",
    )
      .bind(id)
      .first<any>();
    expect(audit.n).toBe(1);
  });
});
