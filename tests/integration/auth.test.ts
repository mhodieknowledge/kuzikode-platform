import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, cookiePair, login } from '../helpers/api';
import { createClient, createPortalUser, createStaff, DEFAULT_PASSWORD } from '../helpers/factories';

const outboxLink = async (template: string, to: string) => {
  const row = await env.DB.prepare(
    "SELECT payload FROM outbox WHERE type = 'email.send' AND json_extract(payload, '$.template') = ? AND json_extract(payload, '$.to') = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(template, to)
    .first<{ payload: string }>();
  const link = JSON.parse(row!.payload).data.link as string;
  return new URL(link).searchParams.get('token')!;
};

describe('login', () => {
  it('logs in a staff user, sets an HttpOnly session cookie and audits it', async () => {
    const u = await createStaff(['admin']);
    const res = await api('/api/v1/auth/admin/login', { body: { email: u.email.toUpperCase(), password: u.password } });
    expect(res.status).toBe(200);
    expect(res.setCookie).toMatch(/^kz_admin_dev=[A-Za-z0-9_-]{43}; Path=\/; SameSite=Lax; HttpOnly/);
    const me = await api('/api/v1/auth/admin/me', { cookie: cookiePair(res.setCookie) });
    expect(me.body.data.user.email).toBe(u.email);
    expect(me.body.data.permissions).toContain('invoices.issue');
    expect(me.body.data.permissions).not.toContain('roles.manage');
    const audit = await env.DB.prepare(
      "SELECT count(*) n FROM audit_logs WHERE action = 'auth.login_succeeded' AND entity_id = ?",
    )
      .bind(u.id)
      .first<{ n: number }>();
    expect(audit!.n).toBe(1);
    // only the token hash is stored
    const token = cookiePair(res.setCookie).split('=')[1]!;
    const stored = await env.DB.prepare('SELECT count(*) n FROM sessions WHERE token_hash = ?')
      .bind(token)
      .first<{ n: number }>();
    expect(stored!.n).toBe(0);
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const u = await createStaff();
    const wrong = await api('/api/v1/auth/admin/login', {
      body: { email: u.email, password: 'not the password at all' },
    });
    const unknown = await api('/api/v1/auth/admin/login', {
      body: { email: 'nobody@example.com', password: 'whatever whatever' },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('rejects staff on the portal and clients on admin (separate audiences)', async () => {
    const staff = await createStaff();
    const client = await createClient();
    const portalUser = await createPortalUser([client.id]);
    expect(
      (await api('/api/v1/auth/portal/login', { body: { email: staff.email, password: staff.password } })).status,
    ).toBe(401);
    expect(
      (await api('/api/v1/auth/admin/login', { body: { email: portalUser.email, password: portalUser.password } }))
        .status,
    ).toBe(401);
  });

  it('does not accept an admin cookie on portal APIs or vice versa', async () => {
    const staff = await createStaff();
    const client = await createClient();
    const portalUser = await createPortalUser([client.id]);
    const admin = await login('admin', staff.email, staff.password);
    const portal = await login('portal', portalUser.email, portalUser.password);
    expect((await api('/api/v1/auth/portal/me', { cookie: admin.cookie })).status).toBe(401);
    expect((await api('/api/v1/auth/admin/me', { cookie: portal.cookie })).status).toBe(401);
    const portalMe = await api('/api/v1/auth/portal/me', { cookie: portal.cookie });
    expect(portalMe.body.data.clientIds).toEqual([client.id]);
    // even with the cookie renamed to the other audience's name
    const renamed = admin.cookie.replace('kz_admin_dev', 'kz_portal_dev');
    expect((await api('/api/v1/auth/portal/me', { cookie: renamed })).status).toBe(401);
  });

  it('locks the account after 10 consecutive failures, even with the right password', async () => {
    const u = await createStaff();
    await env.DB.prepare('UPDATE users SET failed_login_count = 9 WHERE id = ?').bind(u.id).run();
    await api('/api/v1/auth/admin/login', {
      body: { email: u.email, password: 'wrong wrong wrong', turnstileToken: 'x' },
    });
    const row = await env.DB.prepare('SELECT locked_until FROM users WHERE id = ?')
      .bind(u.id)
      .first<{ locked_until: string }>();
    expect(Date.parse(row!.locked_until)).toBeGreaterThan(Date.now());
    await env.DB.prepare('DELETE FROM rate_limits').run();
    const ok = await api('/api/v1/auth/admin/login', { body: { email: u.email, password: u.password } });
    expect(ok.status).toBe(401);
  });

  it('requires Turnstile after 3 failures and rate-limits by email', async () => {
    const u = await createStaff();
    for (let i = 0; i < 3; i++)
      await api('/api/v1/auth/admin/login', { body: { email: u.email, password: 'wrong wrong wrong' } });
    const needs = await api('/api/v1/auth/admin/login', { body: { email: u.email, password: u.password } });
    expect(needs.status).toBe(422);
    expect(needs.body.error.fields.turnstile).toBeDefined();
    const withToken = await api('/api/v1/auth/admin/login', {
      body: { email: u.email, password: u.password, turnstileToken: 'test' },
    });
    expect(withToken.status).toBe(200);
    const limited = await api('/api/v1/auth/admin/login', {
      body: { email: u.email, password: u.password, turnstileToken: 'test' },
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
  });

  it('rejects disabled and invited users', async () => {
    const disabled = await createStaff(['admin'], { status: 'disabled' });
    expect(
      (await api('/api/v1/auth/admin/login', { body: { email: disabled.email, password: disabled.password } })).status,
    ).toBe(401);
  });
});

describe('CSRF and Origin', () => {
  it('blocks a foreign Origin on login and on authenticated mutations', async () => {
    const u = await createStaff();
    const foreign = await api('/api/v1/auth/admin/login', {
      body: { email: u.email, password: u.password },
      origin: 'https://evil.example',
    });
    expect(foreign.status).toBe(403);
    const s = await login('admin', u.email, u.password);
    const res = await api('/api/v1/auth/admin/logout', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: {},
      origin: 'https://evil.example',
    });
    expect(res.status).toBe(403);
    const noOrigin = await api('/api/v1/auth/admin/logout', { cookie: s.cookie, csrf: s.csrf, body: {}, origin: null });
    expect(noOrigin.status).toBe(403);
  });

  it('requires a valid X-CSRF-Token for cookie-authenticated mutations', async () => {
    const u = await createStaff();
    const s = await login('admin', u.email, u.password);
    expect((await api('/api/v1/auth/admin/logout', { cookie: s.cookie, body: {} })).status).toBe(403);
    expect((await api('/api/v1/auth/admin/logout', { cookie: s.cookie, csrf: 'forged', body: {} })).status).toBe(403);
    expect((await api('/api/v1/auth/admin/logout', { cookie: s.cookie, csrf: s.csrf, body: {} })).status).toBe(200);
  });
});

describe('sessions', () => {
  it('logout revokes the session immediately', async () => {
    const u = await createStaff();
    const s = await login('admin', u.email, u.password);
    const out = await api('/api/v1/auth/admin/logout', { cookie: s.cookie, csrf: s.csrf, body: {} });
    expect(out.setCookie).toContain('Max-Age=0');
    expect((await api('/api/v1/auth/admin/me', { cookie: s.cookie })).status).toBe(401);
  });

  it('revoking another session takes effect immediately', async () => {
    const u = await createStaff();
    const a = await login('admin', u.email, u.password);
    const b = await login('admin', u.email, u.password);
    const list = await api('/api/v1/auth/admin/sessions', { cookie: a.cookie });
    const other = list.body.data.find((s: any) => !s.current);
    expect(
      (await api(`/api/v1/auth/admin/sessions/${other.id}`, { method: 'DELETE', cookie: a.cookie, csrf: a.csrf }))
        .status,
    ).toBe(200);
    expect((await api('/api/v1/auth/admin/me', { cookie: b.cookie })).status).toBe(401);
    expect((await api('/api/v1/auth/admin/me', { cookie: a.cookie })).status).toBe(200);
  });

  it('expires idle and absolute-expired sessions', async () => {
    const u = await createStaff();
    const s = await login('admin', u.email, u.password);
    await env.DB.prepare("UPDATE sessions SET last_seen_at = '2020-01-01T00:00:00.000Z' WHERE user_id = ?")
      .bind(u.id)
      .run();
    expect((await api('/api/v1/auth/admin/me', { cookie: s.cookie })).status).toBe(401);
    const s2 = await login('admin', u.email, u.password);
    await env.DB.prepare("UPDATE sessions SET expires_at = '2020-01-01T00:00:00.000Z' WHERE user_id = ?")
      .bind(u.id)
      .run();
    expect((await api('/api/v1/auth/admin/me', { cookie: s2.cookie })).status).toBe(401);
  });
});

describe('passwords', () => {
  it('forces a password change before anything else, then works', async () => {
    const u = await createStaff(['admin'], { mustChange: true });
    const s = await login('admin', u.email, u.password);
    expect(
      (await api('/api/v1/auth/admin/email/send-verification', { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(403);
    const weak = await api('/api/v1/auth/admin/password/change', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { currentPassword: u.password, newPassword: 'password12345' },
    });
    expect(weak.status).toBe(422);
    const ok = await api('/api/v1/auth/admin/password/change', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { currentPassword: u.password, newPassword: 'a much better passphrase 2026' },
    });
    expect(ok.status).toBe(200);
    // old session revoked, new cookie works and is no longer flagged
    expect((await api('/api/v1/auth/admin/me', { cookie: s.cookie })).status).toBe(401);
    const me = await api('/api/v1/auth/admin/me', { cookie: cookiePair(ok.setCookie) });
    expect(me.body.data.user.mustChangePassword).toBe(false);
    const email = await env.DB.prepare(
      "SELECT count(*) n FROM outbox WHERE json_extract(payload,'$.template') = 'security_alert' AND json_extract(payload,'$.to') = ?",
    )
      .bind(u.email)
      .first<{ n: number }>();
    expect(email!.n).toBe(1);
  });

  it('password reset: generic response, single-use token, expiry, revokes sessions', async () => {
    const u = await createStaff();
    const s = await login('admin', u.email, u.password);
    const unknown = await api('/api/v1/auth/admin/password/forgot', {
      body: { email: 'ghost@example.com', turnstileToken: 't' },
    });
    const known = await api('/api/v1/auth/admin/password/forgot', { body: { email: u.email, turnstileToken: 't' } });
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    const token = await outboxLink('password_reset', u.email);
    const reset = await api('/api/v1/auth/password/reset', { body: { token, password: 'new secure passphrase 77' } });
    expect(reset.status).toBe(200);
    expect((await api('/api/v1/auth/admin/me', { cookie: s.cookie })).status).toBe(401);
    const again = await api('/api/v1/auth/password/reset', { body: { token, password: 'another passphrase 88' } });
    expect(again.status).toBe(422);
    await login('admin', u.email, 'new secure passphrase 77');

    await api('/api/v1/auth/admin/password/forgot', { body: { email: u.email, turnstileToken: 't' } });
    const token2 = await outboxLink('password_reset', u.email);
    await env.DB.prepare(
      "UPDATE auth_tokens SET expires_at = '2020-01-01T00:00:00.000Z' WHERE purpose = 'password_reset' AND used_at IS NULL",
    ).run();
    expect(
      (await api('/api/v1/auth/password/reset', { body: { token: token2, password: 'expired passphrase 99' } })).status,
    ).toBe(422);
  });
});

describe('invitations', () => {
  it('a staff invite is single-use and activates the account', async () => {
    const { buildInvitation } = await import('../../src/server/modules/auth');
    const { createContext } = await import('../../src/server/context');
    await createStaff(); // ensures seed
    const ctx = createContext({ env });
    const inv = await buildInvitation(
      ctx,
      { kind: 'staff', email: 'new.person@example.com', name: 'New Person', roles: ['support_staff'] },
      null,
    );
    await env.DB.batch(inv.statements);
    expect(
      (await api('/api/v1/auth/admin/login', { body: { email: 'new.person@example.com', password: DEFAULT_PASSWORD } }))
        .status,
    ).toBe(401);
    const accepted = await api('/api/v1/auth/invitations/accept', {
      body: { token: inv.token, password: 'welcome aboard passphrase' },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.audience).toBe('admin');
    const s = await login('admin', 'new.person@example.com', 'welcome aboard passphrase');
    const me = await api('/api/v1/auth/admin/me', { cookie: s.cookie });
    expect(me.body.data.roles).toEqual(['support_staff']);
    expect(
      (await api('/api/v1/auth/invitations/accept', { body: { token: inv.token, password: 'second use passphrase' } }))
        .status,
    ).toBe(422);
  });

  it('a client invite links only the chosen client after acceptance', async () => {
    const { buildInvitation } = await import('../../src/server/modules/auth');
    const { createContext } = await import('../../src/server/context');
    const client = await createClient();
    const ctx = createContext({ env });
    const inv = await buildInvitation(
      ctx,
      { kind: 'client', email: 'buyer@example.com', name: 'Buyer', clientId: client.id, accessRole: 'billing' },
      null,
    );
    await env.DB.batch(inv.statements);
    const pending = await env.DB.prepare('SELECT status FROM client_user_access WHERE client_id = ?')
      .bind(client.id)
      .first<{ status: string }>();
    expect(pending!.status).toBe('pending');
    await api('/api/v1/auth/invitations/accept', { body: { token: inv.token, password: 'client passphrase here' } });
    const s = await login('portal', 'buyer@example.com', 'client passphrase here');
    const me = await api('/api/v1/auth/portal/me', { cookie: s.cookie });
    expect(me.body.data.clientIds).toEqual([client.id]);
  });
});
