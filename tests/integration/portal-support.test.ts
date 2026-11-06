import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ORIGIN, api, login, type Session } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';
import { pdf } from '../helpers/file-fixtures';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 10);
const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();
const P = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/portal${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });

async function multipart(s: Session, path: string, fields: Record<string, string>, files = 1) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (let i = 0; i < files; i++)
    form.append('files', new File([pdf()], `screenshot-${i}.pdf`, { type: 'application/pdf' }));
  const res = await exports.default.fetch(`${ORIGIN}/api/v1/portal${path}`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'x-csrf-token': s.csrf, origin: ORIGIN },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function portal(clientIds: string[], role: 'owner' | 'member' | 'billing' = 'owner') {
  const user = await createPortalUser(clientIds, { role });
  return { ...(await login('portal', user.email, user.password)), id: user.id, email: user.email };
}

describe('portal support (P5.7)', () => {
  beforeEach(() => seedBase());

  it('opens a request with attachments: numbered, staff notified, client acknowledged, audited', async () => {
    const client = await createClient('Support Client');
    const watcher = await createStaff(['support_staff']);
    const p = await portal([client.id], 'member');

    const bad = await P(p, '/support', { subject: 'x', body: '' });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['body', 'subject']);
    // Clients cannot set priority (staff triage it): unknown fields are refused.
    expect((await P(p, '/support', { subject: 'Site down', body: 'Help', priority: 'urgent' })).status).toBe(422);

    const res = await multipart(
      p,
      '/support',
      { subject: 'Website is down', category: 'website', body: 'It shows a 500.' },
      2,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const id = res.body.data.id as string;
    expect(res.body.data.reference).toMatch(/^SUP-\d{4}-\d{4}$/);
    const r = await row(
      'SELECT client_id, opened_by, status, priority, category FROM support_requests WHERE id = ?',
      id,
    );
    expect(r).toEqual({
      client_id: client.id,
      opened_by: p.id,
      status: 'open',
      priority: 'normal',
      category: 'website',
    });
    const files = await row(
      'SELECT count(*) n FROM support_attachments a JOIN support_messages m ON m.id = a.message_id WHERE m.request_id = ?',
      id,
    );
    expect(files.n).toBe(2);
    expect(
      (
        await row(
          "SELECT count(*) n FROM notifications WHERE user_id = ? AND type = 'support.created' AND entity_id = ?",
          watcher.id,
          id,
        )
      ).n,
    ).toBe(1);
    const ack = await row('SELECT payload FROM outbox WHERE idempotency_key = ?', `email:support_ack:${id}`);
    expect(JSON.parse(ack.payload)).toMatchObject({
      template: 'support_ack',
      to: p.email,
      data: { reference: res.body.data.reference },
    });
    expect(
      (await row("SELECT actor_type FROM audit_logs WHERE action = 'support.created' AND entity_id = ?", id))
        .actor_type,
    ).toBe('client');

    const list = await P(p, '/support');
    expect(list.body.data).toEqual([
      expect.objectContaining({ id, subject: 'Website is down', category: 'Website', status: 'open' }),
    ]);
    const detail = await P(p, `/support/${id}`);
    expect(detail.body.data.messages).toHaveLength(1);
    expect(detail.body.data.messages[0]).toMatchObject({ mine: true, fromTeam: false });
    expect(detail.body.data.messages[0].attachments).toHaveLength(2);
    const fileId = detail.body.data.messages[0].attachments[0].fileId;
    expect(
      (await exports.default.fetch(`${ORIGIN}/api/v1/portal/files/${fileId}`, { headers: { cookie: p.cookie } }))
        .status,
    ).toBe(200);
  });

  it('never shows internal notes or their files; replies reopen; closed requests take no replies', async () => {
    const client = await createClient('Thread Client');
    const agentUser = await createStaff(['support_staff']);
    const agent = await login('admin', agentUser.email, agentUser.password);
    const p = await portal([client.id]);
    const { id } = (
      await P(p, '/support', { subject: 'Email not syncing', body: 'Outlook keeps asking for a password.' })
    ).body.data;

    const note = await exports.default.fetch(`${ORIGIN}/api/v1/admin/support/${id}/messages`, {
      method: 'POST',
      headers: { cookie: agent.cookie, 'x-csrf-token': agent.csrf, origin: ORIGIN },
      body: (() => {
        const f = new FormData();
        f.set('body', 'INTERNAL-NOTE password reset in tenant admin');
        f.set('internal', 'true');
        f.append('files', new File([pdf()], 'internal-log.pdf', { type: 'application/pdf' }));
        return f;
      })(),
    });
    expect(note.status).toBe(201);
    const reply = await api(`/api/v1/admin/support/${id}/messages`, {
      cookie: agent.cookie,
      csrf: agent.csrf,
      body: { body: 'We reset the password. Please try again.' },
    });
    expect(reply.status).toBe(201);

    const d = await P(p, `/support/${id}`);
    expect(d.body.data.request.status).toBe('awaiting_client');
    expect(d.body.data.messages.map((m: any) => m.body)).toEqual([
      'Outlook keeps asking for a password.',
      'We reset the password. Please try again.',
    ]);
    expect(JSON.stringify(d.body)).not.toContain('INTERNAL');
    expect(JSON.stringify(d.body)).not.toContain('internal-log');
    const internalFile = await row(
      `SELECT a.file_id FROM support_attachments a JOIN support_messages m ON m.id = a.message_id
       WHERE m.request_id = ? AND m.is_internal_note = 1`,
      id,
    );
    expect(
      (
        await exports.default.fetch(`${ORIGIN}/api/v1/portal/files/${internalFile.file_id}`, {
          headers: { cookie: p.cookie },
        })
      ).status,
    ).toBe(404);
    expect((await P(p, '/support')).body.data[0].teamReplied).toBe(true);

    // The client answers: back to open, the assignee (the replier) is told.
    const answer = await multipart(p, `/support/${id}/messages`, { body: 'Works now, thanks!' });
    expect(answer.status, JSON.stringify(answer.body)).toBe(201);
    expect(answer.body.data.status).toBe('open');
    expect(
      (
        await row(
          "SELECT count(*) n FROM notifications WHERE user_id = ? AND type = 'support.replied' AND entity_id = ?",
          agentUser.id,
          id,
        )
      ).n,
    ).toBe(1);

    // Mark resolved, then a new message reopens it.
    expect((await P(p, `/support/${id}/resolve`, {})).body.data.status).toBe('resolved');
    expect((await row('SELECT status FROM support_requests WHERE id = ?', id)).status).toBe('resolved');
    expect((await P(p, `/support/${id}/messages`, { body: 'One more thing.' })).body.data.status).toBe('open');

    await env.DB.prepare("UPDATE support_requests SET status = 'closed' WHERE id = ?").bind(id).run();
    const closed = await P(p, `/support/${id}/messages`, { body: 'Hello?' });
    expect(closed.status).toBe(422);
    expect(closed.body.error.fields.body[0]).toMatch(/closed/);
    expect((await P(p, `/support/${id}/resolve`, {})).status).toBe(422);
  });

  it('other clients, unlinked accounts and staff sessions cannot see or touch a request; multi-client users choose', async () => {
    const a = await createClient('Client A');
    const b = await createClient('Client B');
    const owner = await portal([a.id]);
    const { id } = (await P(owner, '/support', { subject: 'Invoice question', body: 'Is VAT included?' })).body.data;

    const other = await portal([b.id]);
    expect((await P(other, '/support')).body.data).toEqual([]);
    expect((await P(other, `/support/${id}`)).status).toBe(404);
    expect((await P(other, `/support/${id}/messages`, { body: 'hi' })).status).toBe(404);
    expect((await P(other, `/support/${id}/resolve`, {})).status).toBe(404);
    // Opening a request for a client you are not linked to is refused.
    const foreign = await P(other, '/support', { clientId: a.id, subject: 'Sneaky', body: 'Should not work' });
    expect(foreign.status).toBe(422);
    expect(foreign.body.error.fields.clientId).toBeTruthy();

    const both = await portal([a.id, b.id]);
    const unchosen = await P(both, '/support', { subject: 'Which one?', body: 'No client chosen' });
    expect(unchosen.body.error.fields.clientId[0]).toMatch(/Choose the company/);
    const chosen = await P(both, '/support', { clientId: b.id, subject: 'For B', body: 'Chosen client' });
    expect(chosen.status).toBe(201);
    expect((await row('SELECT client_id FROM support_requests WHERE id = ?', chosen.body.data.id)).client_id).toBe(
      b.id,
    );

    // A project from another client is refused.
    const prj = `prj_${u()}`;
    await env.DB.prepare(
      "INSERT INTO projects (id, reference, client_id, name, status) VALUES (?, ?, ?, 'B site', 'active')",
    )
      .bind(prj, `PRJ-${u()}`, b.id)
      .run();
    const wrongProject = await P(owner, '/support', { subject: 'About B', body: 'project mismatch', projectId: prj });
    expect(wrongProject.body.error.fields.projectId).toBeTruthy();

    const staffUser = await createStaff(['support_staff']);
    const staff = await login('admin', staffUser.email, staffUser.password);
    expect((await P(staff, `/support/${id}`)).status).toBe(401);
    const n = await row('SELECT count(*) n FROM support_messages WHERE request_id = ?', id);
    expect(n.n).toBe(1);
  });
});

describe('portal "Your services" (P5.7)', () => {
  beforeEach(() => seedBase());

  async function fixture() {
    const client = await createClient('Services Client');
    const subId = `sub_${u()}`;
    await env.DB.prepare(
      `INSERT INTO subscriptions (id, client_id, description, quantity_milli, unit_price_minor, currency, interval, start_date, next_billing_date, status)
       VALUES (?, ?, 'Business Email, 10 mailboxes', 10000, 300, 'USD', 'month', '2026-10-01', '2026-12-01', 'active'),
              (?, ?, 'Old hosting plan', 1000, 2000, 'USD', 'year', '2025-01-01', '2026-01-01', 'cancelled')`,
    )
      .bind(subId, client.id, `sub_${u()}`, client.id)
      .run();
    await env.DB.prepare(
      `INSERT INTO client_assets (id, client_id, type, name, provider, renewal_date, auto_renew, cost_note, credentials_note)
       VALUES (?, ?, 'domain', ?, 'ZISPA', '2027-03-01', 1, 'INTERNAL-COST 12 USD', 'INTERNAL-CRED registrar login')`,
    )
      .bind(`ast_${u()}`, client.id, `services-${u()}.co.zw`)
      .run();
    return { client, subId };
  }

  it('lists active subscriptions and managed assets to owner/billing contacts, never internal notes', async () => {
    const f = await fixture();
    const billing = await portal([f.client.id], 'billing');
    const res = await P(billing, '/services');
    expect(res.status).toBe(200);
    const [g] = res.body.data;
    expect(g.subscriptions).toEqual([
      expect.objectContaining({
        id: f.subId,
        description: 'Business Email, 10 mailboxes',
        amountMinor: 3000,
        currency: 'USD',
        interval: 'month',
        nextBillingDate: '2026-12-01',
        cancellationRequested: false,
      }),
    ]);
    expect(g.assets).toEqual([
      expect.objectContaining({ type: 'domain', typeLabel: 'Domain', provider: 'ZISPA', autoRenew: true }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain('INTERNAL');

    // Members (delivery contacts) do not see prices.
    const member = await portal([f.client.id], 'member');
    expect((await P(member, '/services')).body.data).toEqual([]);
    expect((await P(member, `/services/subscriptions/${f.subId}/cancellation`, {})).status).toBe(404);
  });

  it('"Request cancellation" opens one billing support request per subscription and cancels nothing itself', async () => {
    const f = await fixture();
    const owner = await portal([f.client.id]);
    const first = await P(owner, `/services/subscriptions/${f.subId}/cancellation`, {
      reason: 'Moving to another provider.',
    });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.data.existing).toBe(false);
    const req = await row('SELECT subject, category, client_id FROM support_requests WHERE id = ?', first.body.data.id);
    expect(req).toEqual({
      subject: 'Cancellation request: Business Email, 10 mailboxes',
      category: 'billing',
      client_id: f.client.id,
    });
    const msg = await row('SELECT body FROM support_messages WHERE request_id = ?', first.body.data.id);
    expect(msg.body).toContain('Moving to another provider.');
    expect(msg.body).toContain('2026-12-01');
    expect((await row('SELECT status FROM subscriptions WHERE id = ?', f.subId)).status).toBe('active');
    expect(
      (
        await row(
          "SELECT count(*) n FROM audit_logs WHERE action = 'subscription.cancellation_requested' AND entity_id = ?",
          first.body.data.id,
        )
      ).n,
    ).toBe(1);

    const again = await P(owner, `/services/subscriptions/${f.subId}/cancellation`, {});
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ id: first.body.data.id, existing: true });
    expect((await P(owner, '/services')).body.data[0].subscriptions[0].cancellationRequested).toBe(true);

    // Cancelled subscriptions and other clients' subscriptions are not found.
    const cancelled = await row(
      "SELECT id FROM subscriptions WHERE client_id = ? AND status = 'cancelled'",
      f.client.id,
    );
    expect((await P(owner, `/services/subscriptions/${cancelled.id}/cancellation`, {})).status).toBe(404);
    const other = await portal([(await createClient('Other')).id]);
    expect((await P(other, `/services/subscriptions/${f.subId}/cancellation`, {})).status).toBe(404);
  });
});
