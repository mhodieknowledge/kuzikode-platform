import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, login, type Session } from '../helpers/api';
import { createClient, createPortalUser, createStaff, DEFAULT_PASSWORD } from '../helpers/factories';

const unique = () => Math.random().toString(36).slice(2, 10);
/** A fresh client IP per call keeps the per-IP registration limit out of the way of unrelated tests. */
const ipHeaders = () => ({ 'cf-connecting-ip': `203.0.113.${Math.floor(Math.random() * 250) + 1}` });

async function setRegistration(on: boolean): Promise<void> {
  const admin = await createStaff(['admin']);
  const s = await login('admin', admin.email, admin.password);
  const res = await api('/api/v1/admin/settings/sections/portal', {
    method: 'PUT',
    cookie: s.cookie,
    csrf: s.csrf,
    body: { 'portal.self_registration': on },
  });
  expect(res.status).toBe(200);
}

const register = (body: Record<string, unknown>) =>
  api('/api/v1/auth/portal/register', { body: { turnstileToken: 'test-token', ...body }, headers: ipHeaders() });

async function registrationToken(email: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT payload FROM outbox WHERE type = 'email.send' AND json_extract(payload, '$.template') = 'email_verification' AND json_extract(payload, '$.to') = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(email)
    .first<{ payload: string }>();
  if (!row) return null;
  const link = new URL(JSON.parse(row.payload).data.link as string);
  expect(link.pathname).toBe('/portal/accept-invite');
  return link.searchParams.get('token');
}

const count = async (sql: string, ...params: unknown[]) =>
  (await env.DB.prepare(sql)
    .bind(...params)
    .first<{ n: number }>())!.n;

/** Registers and finishes the sign-up (sets the password from the emailed link). */
async function completeSignup(email: string, company?: string): Promise<{ userId: string; session: Session }> {
  expect((await register({ name: 'Rudo Moyo', email, ...(company ? { company } : {}) })).status).toBe(202);
  const token = await registrationToken(email);
  const accepted = await api('/api/v1/auth/invitations/accept', { body: { token, password: DEFAULT_PASSWORD } });
  expect(accepted.status).toBe(200);
  expect(accepted.body.data.audience).toBe('portal');
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  return { userId: user!.id, session: await login('portal', email, DEFAULT_PASSWORD) };
}

describe('portal self-registration (P5.1)', () => {
  it('is off by default: the API and the page return 404', async () => {
    await setRegistration(false);
    const res = await register({ name: 'Someone', email: `off-${unique()}@example.com` });
    expect(res.status).toBe(404);
  });

  it('needs the security check', async () => {
    await setRegistration(true);
    const res = await api('/api/v1/auth/portal/register', {
      body: { name: 'Someone', email: `nocheck-${unique()}@example.com` },
      headers: ipHeaders(),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.turnstile).toBeDefined();
  });

  it('emails a set-password link; the account cannot sign in before it is finished', async () => {
    await setRegistration(true);
    const email = `new-${unique()}@example.com`;
    const res = await register({ name: 'Rudo Moyo', email, company: 'Moyo Logistics' });
    expect(res.status).toBe(202);
    const user = await env.DB.prepare('SELECT status, password_hash, user_type FROM users WHERE email = ?')
      .bind(email)
      .first<{ status: string; password_hash: string | null; user_type: string }>();
    expect(user).toMatchObject({ status: 'invited', password_hash: null, user_type: 'client' });
    expect(await registrationToken(email)).toBeTruthy();
    const attempt = await api('/api/v1/auth/portal/login', { body: { email, password: DEFAULT_PASSWORD } });
    expect(attempt.status).toBe(401);
  });

  it('answers the same for known emails and sends them nothing', async () => {
    await setRegistration(true);
    const client = await createClient();
    const existing = await createPortalUser([client.id]);
    const staff = await createStaff(['admin']);
    const fresh = await register({ name: 'A', email: `fresh-${unique()}@example.com` });
    const known = await register({ name: 'B', email: existing.email });
    const staffEmail = await register({ name: 'C', email: staff.email });
    expect(known.status).toBe(202);
    expect(staffEmail.status).toBe(202);
    expect(known.body).toEqual(fresh.body);
    expect(staffEmail.body).toEqual(fresh.body);
    expect(await registrationToken(existing.email)).toBeNull();
    expect(await registrationToken(staff.email)).toBeNull();
    const staffRow = await env.DB.prepare('SELECT user_type, status FROM users WHERE id = ?')
      .bind(staff.id)
      .first<{ user_type: string; status: string }>();
    expect(staffRow).toEqual({ user_type: 'staff', status: 'active' });
  });

  it('a finished sign-up sees nothing, is never linked by a matching email, and notifies clients.view staff', async () => {
    await setRegistration(true);
    const email = `match-${unique()}@example.com`;
    // A client and a contact with exactly this email already exist.
    const client = await createClient('Moyo Logistics (Pvt) Ltd');
    await env.DB.prepare(
      "INSERT INTO client_contacts (id, client_id, name, email, is_primary, is_billing) VALUES (?, ?, 'Rudo Moyo', ?, 1, 1)",
    )
      .bind(`ctc_${unique()}`, client.id, email)
      .run();
    await env.DB.prepare('UPDATE clients SET email = ? WHERE id = ?').bind(email, client.id).run();
    const viewer = await createStaff(['support_staff']);
    const outsider = await createStaff(['content_manager']);

    const { userId, session } = await completeSignup(email, 'Moyo Logistics');
    const me = await api('/api/v1/auth/portal/me', { cookie: session.cookie });
    expect(me.body.data.clientIds).toEqual([]);
    expect(await count('SELECT count(*) n FROM client_user_access WHERE user_id = ?', userId)).toBe(0);
    const row = await env.DB.prepare('SELECT status, email_verified_at FROM users WHERE id = ?')
      .bind(userId)
      .first<{ status: string; email_verified_at: string | null }>();
    expect(row!.status).toBe('active');
    expect(row!.email_verified_at).toBeTruthy();

    const note = await env.DB.prepare(
      "SELECT title, body, link FROM notifications WHERE user_id = ? AND type = 'client.registered' AND entity_id = ?",
    )
      .bind(viewer.id, userId)
      .first<{ title: string; body: string; link: string }>();
    expect(note).toMatchObject({ title: 'New portal sign-up: Rudo Moyo', link: '/admin/clients/portal-signups' });
    expect(note!.body).toContain('Moyo Logistics');
    expect(
      await count(
        "SELECT count(*) n FROM notifications WHERE user_id = ? AND type = 'client.registered' AND entity_id = ?",
        outsider.id,
        userId,
      ),
    ).toBe(0);
    expect(
      await count(
        "SELECT count(*) n FROM audit_logs WHERE action IN ('auth.registration_started','auth.registration_completed') AND entity_id = ?",
        userId,
      ),
    ).toBe(2);
  });

  it('staff link a sign-up explicitly (then it sees that client) or decline it (then it cannot sign in)', async () => {
    await setRegistration(true);
    const client = await createClient('Chipo Designs');
    const a = await completeSignup(`link-${unique()}@example.com`);
    const b = await completeSignup(`decline-${unique()}@example.com`);
    const manager = await createStaff(['admin']);
    const s = await login('admin', manager.email, manager.password);
    const supportOnly = await createStaff(['support_staff']);
    const viewOnly = await login('admin', supportOnly.email, supportOnly.password);

    const list = await api('/api/v1/admin/clients/portal-signups', { cookie: s.cookie });
    expect(list.status).toBe(200);
    const ids = list.body.data.map((x: { userId: string }) => x.userId);
    expect(ids).toEqual(expect.arrayContaining([a.userId, b.userId]));

    // Viewing is not enough to link.
    const denied = await api(`/api/v1/admin/clients/portal-signups/${a.userId}/link`, {
      cookie: viewOnly.cookie,
      csrf: viewOnly.csrf,
      body: { clientId: client.id, role: 'member' },
    });
    expect(denied.status).toBe(403);

    const linked = await api(`/api/v1/admin/clients/portal-signups/${a.userId}/link`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { clientId: client.id, role: 'billing' },
    });
    expect(linked.status).toBe(200);
    const me = await api('/api/v1/auth/portal/me', { cookie: a.session.cookie });
    expect(me.body.data.clientIds).toEqual([client.id]);
    expect(
      await count(
        "SELECT count(*) n FROM audit_logs WHERE action = 'client.portal_linked' AND entity_id = ?",
        client.id,
      ),
    ).toBe(1);
    expect(
      await count("SELECT count(*) n FROM notifications WHERE user_id = ? AND type = 'client.portal_linked'", a.userId),
    ).toBe(1);
    // A linked account is no longer a sign-up: linking again is refused.
    const again = await api(`/api/v1/admin/clients/portal-signups/${a.userId}/link`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { clientId: client.id, role: 'owner' },
    });
    expect(again.status).toBe(404);

    // An ordinary (invited) portal user can never be "declined" through this route.
    const regular = await createPortalUser([client.id]);
    const notSignup = await api(`/api/v1/admin/clients/portal-signups/${regular.id}/decline`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: {},
    });
    expect(notSignup.status).toBe(404);

    const declined = await api(`/api/v1/admin/clients/portal-signups/${b.userId}/decline`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: {},
    });
    expect(declined.status).toBe(200);
    expect((await api('/api/v1/auth/portal/me', { cookie: b.session.cookie })).status).toBe(401);
    const relogin = await api('/api/v1/auth/portal/login', {
      body: {
        email: (await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(b.userId).first<{ email: string }>())!
          .email,
        password: DEFAULT_PASSWORD,
      },
    });
    expect(relogin.status).toBe(401);
  });

  it('a second registration before finishing replaces the link; the old one stops working', async () => {
    await setRegistration(true);
    const email = `twice-${unique()}@example.com`;
    await register({ name: 'First', email });
    const first = await registrationToken(email);
    await register({ name: 'Second', email });
    const second = await registrationToken(email);
    expect(second).not.toBe(first);
    const old = await api('/api/v1/auth/invitations/accept', { body: { token: first, password: DEFAULT_PASSWORD } });
    expect(old.status).toBe(422);
    const ok = await api('/api/v1/auth/invitations/accept', { body: { token: second, password: DEFAULT_PASSWORD } });
    expect(ok.status).toBe(200);
    expect(await count('SELECT count(*) n FROM users WHERE email = ?', email)).toBe(1);
  });
});

describe('portal profile and pages (P5.1)', () => {
  it('updates name and phone (CSRF required, phone validated, audited)', async () => {
    const client = await createClient();
    const u = await createPortalUser([client.id]);
    const s = await login('portal', u.email, u.password);
    const noCsrf = await api('/api/v1/auth/portal/profile', {
      method: 'PUT',
      cookie: s.cookie,
      body: { name: 'Tariro N', phone: '+263 77 123 4567' },
    });
    expect(noCsrf.status).toBe(403);
    const bad = await api('/api/v1/auth/portal/profile', {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: { name: 'Tariro N', phone: 'call me' },
    });
    expect(bad.status).toBe(422);
    const extra = await api('/api/v1/auth/portal/profile', {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: { name: 'Tariro N', phone: '', email: 'other@example.com' },
    });
    expect(extra.status).toBe(422);
    const ok = await api('/api/v1/auth/portal/profile', {
      method: 'PUT',
      cookie: s.cookie,
      csrf: s.csrf,
      body: { name: 'Tariro N', phone: '+263 77 123 4567' },
    });
    expect(ok.status).toBe(200);
    const row = await env.DB.prepare('SELECT name, phone, email FROM users WHERE id = ?')
      .bind(u.id)
      .first<{ name: string; phone: string; email: string }>();
    expect(row).toEqual({ name: 'Tariro N', phone: '+263 77 123 4567', email: u.email });
    expect(
      await count("SELECT count(*) n FROM audit_logs WHERE action = 'user.profile_updated' AND entity_id = ?", u.id),
    ).toBe(1);
  });
});
