import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ORIGIN, api, login } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';
import { pdf } from '../helpers/file-fixtures';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const S_ = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/support${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();

async function multipartReply(s: S, id: string, fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.append('files', new File([pdf()], 'screenshot.pdf', { type: 'application/pdf' }));
  const res = await exports.default.fetch(`${ORIGIN}/api/v1/admin/support/${id}/messages`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'x-csrf-token': s.csrf, origin: ORIGIN },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('support inbox (P4.14)', () => {
  beforeEach(() => seedBase());

  it('opens a numbered request on a client’s behalf and notifies support staff', async () => {
    const support = await staff(['support_staff']);
    const colleague = await createStaff(['support_staff']);
    const client = await createClient();
    const res = await S_(support, '', {
      clientId: client.id,
      subject: 'Email not syncing',
      priority: 'high',
      body: 'Phone call: Outlook stopped syncing.',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.reference).toMatch(/^SUP-\d{4}-\d{4}$/);
    const r = await row('SELECT * FROM support_requests WHERE id = ?', res.body.data.id);
    expect(r).toMatchObject({ status: 'open', priority: 'high', opened_by: support.id });
    const notified = (
      await env.DB.prepare("SELECT user_id FROM notifications WHERE type = 'support.created' AND entity_id = ?")
        .bind(r.id)
        .all<{ user_id: string }>()
    ).results.map((n) => n.user_id);
    // Colleagues hear about it; the person who opened it doesn't get a notification about their own action.
    expect(notified).toContain(colleague.id);
    expect(notified).not.toContain(support.id);
    expect((await S_(support, '', { clientId: client.id, subject: 'x', body: 'y' })).status).toBe(422);
    const list = await S_(support, `?clientId=${client.id}`);
    expect(list.body.data.items.map((i: any) => i.id)).toEqual([r.id]);
  });

  it('emails client replies, keeps internal notes and their attachments away from the client', async () => {
    const s = await staff(['admin']);
    const client = await createClient();
    const portalUser = await createPortalUser([client.id]);
    const { id } = (await S_(s, '', { clientId: client.id, subject: 'Site down', body: 'Client reports 500 errors.' }))
      .body.data;

    const note = await multipartReply(s, id, { body: 'Checked logs: DB migration failed.', internal: 'true' });
    expect(note.status, JSON.stringify(note.body)).toBe(201);
    expect(note.body.data.status).toBe('open');
    const reply = await multipartReply(s, id, { body: 'Fixed. Please check again.', internal: 'false' });
    expect(reply.status).toBe(201);
    expect(reply.body.data.status).toBe('awaiting_client');
    const r = await row('SELECT status, assigned_to FROM support_requests WHERE id = ?', id);
    expect(r).toEqual({ status: 'awaiting_client', assigned_to: s.id }); // the replier picks it up

    const emails = await env.DB.prepare(
      "SELECT idempotency_key FROM outbox WHERE idempotency_key LIKE 'email:support_reply:%'",
    ).all<any>();
    expect(emails.results.some((e: any) => e.idempotency_key.endsWith(reply.body.data.messageId))).toBe(true);
    expect(emails.results.some((e: any) => e.idempotency_key.endsWith(note.body.data.messageId))).toBe(false);
    expect(
      (
        await row(
          "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'support.replied'",
          portalUser.id,
        )
      ).n,
    ).toBe(1);

    const files = await env.DB.prepare(
      'SELECT a.file_id, m.is_internal_note FROM support_attachments a JOIN support_messages m ON m.id = a.message_id WHERE m.request_id = ?',
    )
      .bind(id)
      .all<any>();
    const portal = await login('portal', portalUser.email, portalUser.password);
    for (const f of files.results) {
      const res = await exports.default.fetch(`${ORIGIN}/api/v1/portal/files/${f.file_id}`, {
        headers: { cookie: portal.cookie },
      });
      expect(res.status).toBe(f.is_internal_note ? 404 : 200);
    }
    const detail = await S_(s, `/${id}`);
    expect(detail.body.data.messages).toHaveLength(3);
    expect(detail.body.data.messages[1].attachments).toHaveLength(1);
  });

  it('lets managers assign and change status; support staff reply but cannot close', async () => {
    const admin = await staff(['admin']);
    const support = await staff(['support_staff']);
    const client = await createClient();
    const { id } = (await S_(admin, '', { clientId: client.id, subject: 'New mailbox', body: 'Please add a mailbox.' }))
      .body.data;
    expect((await S_(admin, `/${id}`, { assignedTo: support.id, priority: 'urgent' }, 'PATCH')).status).toBe(200);
    expect(
      (await row('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND entity_id = ?', support.id, id)).n,
    ).toBeGreaterThan(0);
    expect((await S_(support, '?assignee=me')).body.data.items.some((i: any) => i.id === id)).toBe(true);
    expect((await S_(support, `/${id}`, { status: 'closed' }, 'PATCH')).status).toBe(403);
    expect((await S_(support, `/${id}/messages`, { body: 'Done', status: 'resolved' })).status).toBe(403);
    expect((await S_(support, `/${id}/messages`, { body: 'Mailbox created; details sent separately.' })).status).toBe(
      201,
    );
    expect((await S_(admin, `/${id}`, { status: 'resolved' }, 'PATCH')).status).toBe(200);
    expect((await S_(admin, `/${id}`, { assignedTo: 'usr_nobody' }, 'PATCH')).status).toBe(422);
    expect((await row('SELECT status FROM support_requests WHERE id = ?', id)).status).toBe('resolved');
    const content = await staff(['content_manager']);
    expect((await S_(content, '')).status).toBe(403);
  });
});
