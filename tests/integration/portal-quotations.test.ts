import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, login, type Session } from '../helpers/api';
import { createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

async function staffSession() {
  const u = await createStaff(['admin']);
  return { id: u.id, s: await login('admin', u.email, u.password) };
}

async function newClient(s: Session, name: string) {
  const res = await api('/api/v1/admin/clients', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      type: 'business',
      displayName: name,
      email: `accounts-${Math.random().toString(36).slice(2, 8)}@example.com`,
      defaultCurrency: 'USD',
      paymentTermsDays: 7,
      tags: [],
    },
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function quotation(s: Session, clientId: string, opts: { send?: boolean; title?: string } = {}) {
  const res = await api('/api/v1/admin/quotations', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      clientId,
      title: opts.title ?? 'Company website',
      currency: 'USD',
      items: [
        {
          description: 'Website design',
          quantity: '1',
          unitPriceMinor: 80_000,
          discountType: 'none',
          discountValue: 0,
        },
      ],
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const id = res.body.data.id as string;
  if (opts.send !== false) {
    const sent = await api(`/api/v1/admin/quotations/${id}/send`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
  }
  return id;
}

const P = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/portal${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });

const statusOf = async (id: string) =>
  (await env.DB.prepare('SELECT status FROM quotations WHERE id = ?').bind(id).first<{ status: string }>())!.status;

describe('portal quotations (P5.3)', () => {
  beforeEach(async () => {
    await seedBase();
  });

  it('lists only sent quotations of the caller’s clients; another client’s or a draft is 404 everywhere', async () => {
    const { s } = await staffSession();
    const mine = await newClient(s, 'Mine Ltd');
    const other = await newClient(s, 'Other Ltd');
    const sent = await quotation(s, mine, { title: 'Mine sent' });
    const draft = await quotation(s, mine, { send: false, title: 'Mine draft' });
    const foreign = await quotation(s, other, { title: 'Other sent' });
    const user = await createPortalUser([mine], { role: 'member' });
    const p = await login('portal', user.email, user.password);

    const list = await P(p, '/quotations');
    expect(list.status).toBe(200);
    expect(list.body.data.map((q: { id: string }) => q.id)).toEqual([sent]);
    expect(list.body.data[0]).toMatchObject({ open: true, status: 'sent', totalMinor: 80_000, clientName: 'Mine Ltd' });

    for (const id of [draft, foreign, 'quo_nope']) {
      expect((await P(p, `/quotations/${id}`)).status).toBe(404);
      expect((await P(p, `/quotations/${id}/pdf`)).status).toBe(404);
      expect((await P(p, `/quotations/${id}/respond`, { decision: 'reject' })).status).toBe(404);
    }
    expect(await statusOf(foreign)).toBe('sent');
    expect(await statusOf(draft)).toBe('draft');
  });

  it('opening one counts as the first view (author notified once); the PDF downloads', async () => {
    const { id: authorId, s } = await staffSession();
    const c = await newClient(s, 'Viewer Ltd');
    const q = await quotation(s, c);
    const user = await createPortalUser([c]);
    const p = await login('portal', user.email, user.password);

    const detail = await P(p, `/quotations/${q}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.quotation).toMatchObject({ id: q, status: 'viewed', totalMinor: 80_000 });
    expect(detail.body.data.open).toBe(true);
    expect(detail.body.data.items).toHaveLength(1);
    await P(p, `/quotations/${q}`);
    const notes = await env.DB.prepare(
      "SELECT count(*) n FROM notifications WHERE user_id = ? AND type = 'quotation.viewed' AND entity_id = ?",
    )
      .bind(authorId, q)
      .first<{ n: number }>();
    expect(notes!.n).toBe(1);

    const pdf = await P(p, `/quotations/${q}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('cache-control')).toBe('private, no-store');
  });

  it('accepting needs a typed name and confirmation, is recorded as the client, and can only happen once', async () => {
    const { s } = await staffSession();
    const watcher = await createStaff(['finance_manager']);
    const c = await newClient(s, 'Accept Ltd');
    const q = await quotation(s, c);
    const user = await createPortalUser([c], { role: 'billing' });
    const p = await login('portal', user.email, user.password);

    const noName = await P(p, `/quotations/${q}/respond`, { decision: 'accept', agree: true });
    expect(noName.status).toBe(422);
    const noCsrf = await api(`/api/v1/portal/quotations/${q}/respond`, {
      cookie: p.cookie,
      body: { decision: 'accept', name: 'Tariro Banda', agree: true },
    });
    expect(noCsrf.status).toBe(403);
    const ok = await P(p, `/quotations/${q}/respond`, { decision: 'accept', name: 'Tariro Banda', agree: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('accepted');
    const row = await env.DB.prepare('SELECT status, accepted_by_name FROM quotations WHERE id = ?')
      .bind(q)
      .first<{ status: string; accepted_by_name: string }>();
    expect(row).toEqual({ status: 'accepted', accepted_by_name: 'Tariro Banda' });
    const audit = await env.DB.prepare(
      "SELECT actor_type, actor_user_id FROM audit_logs WHERE action = 'quotation.accepted' AND entity_id = ?",
    )
      .bind(q)
      .first<{ actor_type: string; actor_user_id: string }>();
    expect(audit).toEqual({ actor_type: 'client', actor_user_id: user.id });
    const note = await env.DB.prepare(
      "SELECT count(*) n FROM notifications WHERE user_id = ? AND type = 'quotation.accepted' AND entity_id = ?",
    )
      .bind(watcher.id, q)
      .first<{ n: number }>();
    expect(note!.n).toBe(1);

    const again = await P(p, `/quotations/${q}/respond`, { decision: 'reject' });
    expect(again.status).toBe(409);
    const list = await P(p, '/quotations?show=open');
    expect(list.body.data).toEqual([]);
  });

  it('declining records the reason; an expired quotation can no longer be answered', async () => {
    const { s } = await staffSession();
    const c = await newClient(s, 'Decline Ltd');
    const q1 = await quotation(s, c, { title: 'First' });
    const q2 = await quotation(s, c, { title: 'Second' });
    await env.DB.prepare("UPDATE quotations SET valid_until = '2000-01-01' WHERE id = ?").bind(q2).run();
    const user = await createPortalUser([c]);
    const p = await login('portal', user.email, user.password);

    const no = await P(p, `/quotations/${q1}/respond`, { decision: 'reject', reason: 'Over our budget this year.' });
    expect(no.status).toBe(200);
    const row = await env.DB.prepare('SELECT status, rejection_reason FROM quotations WHERE id = ?')
      .bind(q1)
      .first<{ status: string; rejection_reason: string }>();
    expect(row).toEqual({ status: 'rejected', rejection_reason: 'Over our budget this year.' });

    const expired = await P(p, `/quotations/${q2}/respond`, { decision: 'accept', name: 'Tariro Banda', agree: true });
    expect(expired.status).toBe(409);
    expect((await P(p, `/quotations/${q2}`)).body.data.open).toBe(false);
    const all = (await P(p, '/quotations')).body.data as { id: string; open: boolean }[];
    expect(all.map((q) => q.open)).toEqual([false, false]);
  });
});
