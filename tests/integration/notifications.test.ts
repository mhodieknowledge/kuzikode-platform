import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { processOutbox } from '../../src/server/jobs/consumer';
import { runScheduled, CRON_FREQUENT } from '../../src/server/jobs/scheduled';
import { getPublicQuotation } from '../../src/server/modules/quotations';
import { dispatchNotificationEmails, notifyStaffWithPermission } from '../../src/server/modules/notifications';
import { businessDate } from '../../src/server/lib/dates';
import { api, cookiePair, login } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id, email: u.email, password: u.password };
}
type S = Awaited<ReturnType<typeof staff>>;
const A = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const all = async (sql: string, ...p: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...p)
      .all<any>()
  ).results;
const notes = (userId: string, type: string) =>
  all('SELECT * FROM notifications WHERE user_id = ? AND type = ? ORDER BY created_at', userId, type);
const sysCtx = () => createContext({ env, actor: { type: 'system', userId: null } });

async function newClient(s: S) {
  const res = await A(s, '/clients', {
    type: 'business',
    displayName: 'Baobab Foods',
    email: 'accounts@baobab.example',
    defaultCurrency: 'USD',
    paymentTermsDays: 7,
    tags: [],
    primaryContact: { name: 'Tariro Banda', email: 'tariro@baobab.example' },
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}
const items = [
  { description: 'Website build', quantity: '1', unitPriceMinor: 80_000, discountType: 'none', discountValue: 0 },
];

async function sentQuotation(s: S, clientId: string) {
  const q = await A(s, '/quotations', { clientId, title: 'New website', currency: 'USD', items });
  expect(q.status, JSON.stringify(q.body)).toBe(201);
  const id = q.body.data.id as string;
  expect((await A(s, `/quotations/${id}/send`, {})).status).toBe(200);
  const link = (await A(s, `/quotations/${id}`)).body.data.publicLink as string;
  return { id, token: link.split('/q/')[1]! };
}

describe('notifications (P4.16)', () => {
  beforeEach(async () => {
    await seedBase();
    // Many sign-ins from one test IP: start each test with a clean login rate-limit window.
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });

  it('quotation.viewed goes to the quotation author; quotation.rejected to staff who can see quotations', async () => {
    const author = await staff(['admin']);
    const colleague = await createStaff(['finance_manager']); // sees quotations; no sign-in needed
    const { id, token } = await sentQuotation(author, await newClient(await staff(['admin'])));
    await getPublicQuotation(createContext({ env }), token);
    expect((await notes(author.id, 'quotation.viewed')).map((n) => n.entity_id)).toEqual([id]);
    const res = await api(`/api/v1/public/quotations/${token}/respond`, {
      body: { decision: 'reject', reason: 'Over budget.' },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await notes(colleague.id, 'quotation.rejected')).map((n) => n.entity_id)).toEqual([id]);
  });

  it('invoice.issued and payment.received reach finance staff, not the person who did it', async () => {
    const finance = await staff(['admin']);
    const colleague = await createStaff(['finance_manager']);
    const clientId = await newClient(finance);
    const draft = await A(finance, '/invoices', { clientId, currency: 'USD', items });
    const id = draft.body.data.id as string;
    expect((await A(finance, `/invoices/${id}/issue`, { send: false })).status).toBe(200);
    const pay = await A(finance, `/invoices/${id}/payments`, {
      amountMinor: 80_000,
      method: 'bank_transfer',
      receivedOn: businessDate(new Date()),
    });
    expect(pay.status, JSON.stringify(pay.body)).toBe(201);
    expect((await notes(colleague.id, 'invoice.issued')).length).toBe(1);
    expect((await notes(colleague.id, 'payment.received')).length).toBe(1);
    expect((await notes(finance.id, 'invoice.issued')).length).toBe(0);
    expect((await notes(finance.id, 'payment.received')).length).toBe(0);
  });

  it('milestone.updated: status changes notify the project team and (client-visible only) the portal users', async () => {
    const pm = await staff(['project_manager']);
    const member = await createStaff([]);
    const client = await createClient();
    const portal = await createPortalUser([client.id]);
    const p = await A(pm, '/projects', { clientId: client.id, name: 'Booking platform' });
    const projectId = p.body.data.id as string;
    await env.DB.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')")
      .bind(projectId, member.id)
      .run();
    const visible = (await A(pm, `/projects/${projectId}/milestones`, { title: 'Design', clientVisible: true })).body
      .data.id;
    const hidden = (await A(pm, `/projects/${projectId}/milestones`, { title: 'Infra', clientVisible: false })).body
      .data.id;
    // Edits that keep the status don't notify anyone.
    await A(pm, `/projects/${projectId}/milestones/${visible}`, { title: 'Design v2', clientVisible: true }, 'PUT');
    expect(await notes(member.id, 'milestone.updated')).toEqual([]);
    const done = { status: 'completed' };
    expect(
      (
        await A(
          pm,
          `/projects/${projectId}/milestones/${visible}`,
          { title: 'Design v2', clientVisible: true, ...done },
          'PUT',
        )
      ).status,
    ).toBe(200);
    await A(
      pm,
      `/projects/${projectId}/milestones/${hidden}`,
      { title: 'Infra', clientVisible: false, ...done },
      'PUT',
    );
    const team = await notes(member.id, 'milestone.updated');
    expect(team.map((n) => n.title)).toEqual(['Milestone completed: Design v2', 'Milestone completed: Infra']);
    expect(team[0].link).toBe(`/admin/projects/${projectId}`);
    const client_ = await notes(portal.id, 'milestone.updated');
    expect(client_.map((n) => [n.title, n.link, n.email_state])).toEqual([
      ['Milestone completed: Design v2', `/portal/projects/${projectId}`, 'none'],
    ]);
    expect(await notes(pm.id, 'milestone.updated')).toEqual([]); // the person who changed it
  });

  it('support.replied: the assignee hears about replies and notes by someone else', async () => {
    const assignee = await staff(['support_staff']);
    const admin = await staff(['admin']);
    const client = await createClient();
    const { id } = (
      await A(admin, '/support', {
        clientId: client.id,
        subject: 'VPN down',
        body: 'Call log',
        assignedTo: assignee.id,
      })
    ).body.data;
    expect((await A(admin, `/support/${id}/messages`, { body: 'Checked the router.', internal: true })).status).toBe(
      201,
    );
    expect((await A(assignee, `/support/${id}/messages`, { body: 'Fixed, please retry.' })).status).toBe(201);
    const got = await notes(assignee.id, 'support.replied');
    expect(got.map((n) => n.title)).toEqual([expect.stringMatching(/^Internal note on SUP-\d{4}-\d{4}: VPN down$/)]);
  });

  it('security.alert: password change and a sign-in from a new browser show in-app (always on) next to the email', async () => {
    const u = await createStaff(['support_staff']);
    const first = await login('admin', u.email, u.password); // first sign-in: nothing to compare with, no alert
    expect(await notes(u.id, 'security.alert')).toEqual([]);
    await login('admin', u.email, u.password); // same browser: no alert
    expect(await notes(u.id, 'security.alert')).toEqual([]);
    const other = await api('/api/v1/auth/admin/login', {
      body: { email: u.email, password: u.password },
      headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Mobile Safari' },
    });
    expect(other.status).toBe(200);
    expect((await notes(u.id, 'security.alert')).map((n) => n.title)).toEqual(['New sign-in to your account']);
    const newLoginEmail = await all(
      'SELECT payload FROM outbox WHERE instr(idempotency_key, ?) = 1',
      `email:security:new_login:${u.id}:`,
    );
    expect(newLoginEmail.length).toBe(1);
    // Turning security off isn't possible: the type isn't tunable.
    const put = await api('/api/v1/admin/settings/notification-preferences', {
      method: 'PUT',
      cookie: first.cookie,
      csrf: first.csrf,
      body: { prefs: [{ type: 'security.alert', inApp: false, email: false }] },
    });
    expect(put.status).toBe(422);
    const change = await api('/api/v1/auth/admin/password/change', {
      cookie: first.cookie,
      csrf: first.csrf,
      body: { currentPassword: u.password, newPassword: 'A-much-longer-new-passphrase-2026' },
    });
    expect(change.status, JSON.stringify(change.body)).toBe(200);
    const titles = (await notes(u.id, 'security.alert')).map((n) => n.title);
    expect(titles).toContain('Your password was changed');
    // Security notices never go through the notification email dispatcher (the auth flow already emailed).
    expect((await notes(u.id, 'security.alert')).every((n) => n.email_state === 'none')).toBe(true);
    const cookie = cookiePair(change.setCookie);
    const list = await api('/api/v1/admin/notifications', { cookie });
    expect(list.body.data.items.some((i: any) => i.title === 'Your password was changed')).toBe(true);
  });

  it('follows preferences: in-app off hides the row but still emails; both off creates nothing', async () => {
    const quiet = await staff(['support_staff']);
    const mailOnly = await staff(['support_staff']);
    const off = await staff(['support_staff']);
    const set = (s: S, inApp: boolean, email: boolean) =>
      A(s, '/settings/notification-preferences', { prefs: [{ type: 'support.created', inApp, email }] }, 'PUT');
    expect((await set(quiet, true, false)).status).toBe(200);
    expect((await set(mailOnly, false, true)).status).toBe(200);
    expect((await set(off, false, false)).status).toBe(200);
    const admin = await staff(['admin']);
    const client = await createClient();
    const { id } = (await A(admin, '/support', { clientId: client.id, subject: 'Printer', body: 'Jammed' })).body.data;
    const row = async (u: S) => (await notes(u.id, 'support.created')).find((n) => n.entity_id === id);
    expect(await row(quiet)).toMatchObject({ in_app: 1, email_state: 'none' });
    expect(await row(mailOnly)).toMatchObject({ in_app: 0, email_state: 'pending' });
    expect(await row(off)).toBeUndefined();
    // The bell and the page only show in-app rows.
    const bell = (await A(mailOnly, '/notifications')).body.data;
    expect(bell.items.some((i: any) => i.entityId === id || i.title === 'New support request: Printer')).toBe(false);
    expect(
      (await A(quiet, '/notifications')).body.data.items.some((i: any) => i.title === 'New support request: Printer'),
    ).toBe(true);
  });

  it('dispatches pending notification emails once, even when the cron runs twice or overlaps', async () => {
    const a = await staff(['support_staff']);
    const disabled = await createStaff(['support_staff']);
    const admin = await staff(['admin']);
    const client = await createClient();
    const { id } = (await A(admin, '/support', { clientId: client.id, subject: 'Email', body: 'Bounce' })).body.data;
    await env.DB.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").bind(disabled.id).run();
    const ctx = sysCtx();
    const [r1, r2] = await Promise.all([dispatchNotificationEmails(ctx), dispatchNotificationEmails(ctx)]);
    await runScheduled(ctx, { cron: CRON_FREQUENT, scheduledTime: Date.now() });
    expect(r1.queued + r2.queued).toBeGreaterThan(0);
    const jobs = await all(
      `SELECT o.id, o.payload FROM outbox o JOIN notifications n ON o.idempotency_key = 'email:notification:' || n.id
       WHERE n.entity_id = ? AND n.user_id = ?`,
      id,
      a.id,
    );
    expect(jobs.length).toBe(1);
    const payload = JSON.parse(jobs[0].payload);
    expect(payload).toMatchObject({ template: 'notification', to: a.email });
    expect(payload.data.link).toMatch(new RegExp(`/admin/support/${id}$`));
    expect((await notes(a.id, 'support.created'))[0].email_state).toBe('queued');
    expect((await notes(disabled.id, 'support.created'))[0].email_state).toBe('skipped');
    await processOutbox(ctx, jobs[0].id);
    const log = await all('SELECT template, to_email, status FROM email_logs WHERE to_email = ?', a.email);
    expect(log).toEqual([expect.objectContaining({ template: 'notification', to_email: a.email })]);
  });

  it('a failed email job notifies in-app only (no email about failing email)', async () => {
    const admin = await createStaff(['admin']);
    await env.DB.batch([
      notifyStaffWithPermission(sysCtx(), 'settings.manage', {
        type: 'system.job_failed',
        title: 'A background job failed',
        dedupeKey: 'job_failed:test',
        email: false,
      }),
    ]);
    expect((await notes(admin.id, 'system.job_failed'))[0]).toMatchObject({ in_app: 1, email_state: 'none' });
  });

  it('marks one notification as read, only for its owner', async () => {
    const a = await staff(['support_staff']);
    const b = await staff(['support_staff']);
    const admin = await staff(['admin']);
    const client = await createClient();
    await A(admin, '/support', {
      clientId: client.id,
      subject: 'Laptop will not boot',
      body: 'Black screen since this morning.',
    });
    const [na] = await notes(a.id, 'support.created');
    expect((await A(b, '/notifications/read', { ids: [na.id] })).body.data.updated).toBe(0);
    expect((await A(a, '/notifications/read', { ids: [na.id] })).body.data.updated).toBe(1);
    expect((await A(a, '/notifications?unread=1')).body.data.unread).toBe(0);
  });
});
