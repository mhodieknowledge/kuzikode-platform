import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { totp } from '../../src/server/lib/totp';
import { api, cookiePair, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';

async function enrol(s: { cookie: string; csrf: string }) {
  const start = await api('/api/v1/auth/admin/mfa/enrol', { cookie: s.cookie, csrf: s.csrf, body: {} });
  expect(start.status).toBe(200);
  const secret = start.body.data.secret as string;
  expect(start.body.data.otpauthUri).toContain(`secret=${secret}`);
  const confirm = await api('/api/v1/auth/admin/mfa/enrol/confirm', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: { code: await totp(secret, Date.now()) },
  });
  expect(confirm.status).toBe(200);
  return { secret, backupCodes: confirm.body.data.backupCodes as string[] };
}

describe('two-factor authentication', () => {
  it('is mandatory for super admins: everything else is blocked until enrolment', async () => {
    const u = await createStaff(['super_admin']);
    const login1 = await api('/api/v1/auth/admin/login', { body: { email: u.email, password: u.password } });
    expect(login1.body.data.mfaEnrolmentRequired).toBe(true);
    const s = await login('admin', u.email, u.password);
    const blocked = await api('/api/v1/auth/admin/email/send-verification', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: {},
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.reason).toBe('mfa_enrolment_required');
    const { secret } = await enrol(s);
    const db = await env.DB.prepare('SELECT totp_secret_enc FROM user_mfa WHERE user_id = ?')
      .bind(u.id)
      .first<{ totp_secret_enc: string }>();
    expect(db!.totp_secret_enc).not.toContain(secret);
    expect(db!.totp_secret_enc.startsWith('v1.')).toBe(true);
    expect(
      (await api('/api/v1/auth/admin/email/send-verification', { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(200);
  });

  it('requires the code at the next login, rejects replays, and accepts a backup code once', async () => {
    const u = await createStaff(['finance_manager']);
    const first = await login('admin', u.email, u.password);
    const { secret, backupCodes } = await enrol(first);

    const res = await api('/api/v1/auth/admin/login', { body: { email: u.email, password: u.password } });
    expect(res.body.data.mfaRequired).toBe(true);
    const cookie = cookiePair(res.setCookie);
    const csrf = (await api('/api/v1/auth/admin/me', { cookie })).body.data.csrfToken;
    const gated = await api('/api/v1/auth/admin/email/send-verification', { cookie, csrf, body: {} });
    expect(gated.body.error.reason).toBe('mfa_required');
    expect((await api('/api/v1/auth/admin/mfa/verify', { cookie, csrf, body: { code: '000000' } })).status).toBe(422);

    // The enrolment code's step was recorded, so the same code can't be replayed now.
    const code = await totp(secret, Date.now());
    const replay = await api('/api/v1/auth/admin/mfa/verify', { cookie, csrf, body: { code } });
    expect(replay.status).toBe(422);

    // A backup code works once.
    expect(
      (await api('/api/v1/auth/admin/mfa/verify', { cookie, csrf, body: { code: backupCodes[0]!.toUpperCase() } }))
        .status,
    ).toBe(200);
    expect((await api('/api/v1/auth/admin/email/send-verification', { cookie, csrf, body: {} })).status).toBe(200);

    const third = await api('/api/v1/auth/admin/login', { body: { email: u.email, password: u.password } });
    const c3 = cookiePair(third.setCookie);
    const csrf3 = (await api('/api/v1/auth/admin/me', { cookie: c3 })).body.data.csrfToken;
    expect(
      (await api('/api/v1/auth/admin/mfa/verify', { cookie: c3, csrf: csrf3, body: { code: backupCodes[0] } })).status,
    ).toBe(422);
    expect(
      (await api('/api/v1/auth/admin/mfa/verify', { cookie: c3, csrf: csrf3, body: { code: backupCodes[1] } })).status,
    ).toBe(200);
  });

  it('is optional for other staff; disabling needs password + code; mandatory roles cannot disable', async () => {
    const u = await createStaff(['content_manager']);
    const s = await login('admin', u.email, u.password);
    expect(
      (await api('/api/v1/auth/admin/email/send-verification', { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(200);
    const { secret } = await enrol(s);
    const later = Date.now() + 30_000;
    const bad = await api('/api/v1/auth/admin/mfa/disable', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { password: 'wrong password!!', code: await totp(secret, later) },
    });
    expect(bad.status).toBe(422);
    const ok = await api('/api/v1/auth/admin/mfa/disable', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { password: u.password, code: await totp(secret, later) },
    });
    expect(ok.status).toBe(200);

    const fin = await createStaff(['finance_manager']);
    const fs = await login('admin', fin.email, fin.password);
    const { secret: fsec } = await enrol(fs);
    const denied = await api('/api/v1/auth/admin/mfa/disable', {
      cookie: fs.cookie,
      csrf: fs.csrf,
      body: { password: fin.password, code: await totp(fsec, Date.now() + 30_000) },
    });
    expect(denied.status).toBe(403);
  });

  it('only a super admin can reset another user’s 2FA, and it is audited', async () => {
    const target = await createStaff(['content_manager']);
    const ts = await login('admin', target.email, target.password);
    await enrol(ts);
    const admin = await createStaff(['admin']);
    const as = await login('admin', admin.email, admin.password);
    expect(
      (await api(`/api/v1/admin/users/${target.id}/mfa/reset`, { cookie: as.cookie, csrf: as.csrf, body: {} })).status,
    ).toBe(403);

    const sa = await createStaff(['super_admin']);
    const ss = await login('admin', sa.email, sa.password);
    await enrol(ss);
    expect(
      (await api(`/api/v1/admin/users/${target.id}/mfa/reset`, { cookie: ss.cookie, csrf: ss.csrf, body: {} })).status,
    ).toBe(200);
    expect(await env.DB.prepare('SELECT 1 FROM user_mfa WHERE user_id = ?').bind(target.id).first()).toBeNull();
    expect((await api('/api/v1/auth/admin/me', { cookie: ts.cookie })).status).toBe(401);
    const audit = await env.DB.prepare(
      "SELECT count(*) n FROM audit_logs WHERE action = 'auth.mfa_reset_by_admin' AND entity_id = ?",
    )
      .bind(target.id)
      .first<{ n: number }>();
    expect(audit!.n).toBe(1);
  });
});
