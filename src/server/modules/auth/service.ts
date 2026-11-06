/**
 * Authentication: passwords, sessions (admin + portal audiences), CSRF, password reset, email verification and
 * invitations (docs/07 §1–§4, §9). Business rules only; SQL lives in repository.ts.
 */
import type { Audience } from '../../../shared/schemas/auth';
import { ALL_PERMISSIONS, isPermission, type Permission } from '../../../shared/permissions';
import type { RequestContext } from '../../context';
import { Batch, assertChanges } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { clearCookie, parseCookies, serializeCookie } from '../../lib/cookies';
import { hashPassword, hmacSha256Base64Url, sha256Hex, timingSafeEqualString, verifyPassword } from '../../lib/crypto';
import { AppError, notFound, unauthenticated, validationError } from '../../lib/errors';
import { newId, randomToken } from '../../lib/ids';
import { passwordProblem } from '../../lib/passwords';
import { enforce, hit, peek } from '../../lib/rate-limit';
import { verifyTurnstile } from '../../lib/turnstile';
import { dispatch, enqueue } from '../../jobs/outbox';
import { notifySecurity, notifyStaffWithPermission } from '../notifications';
import { getSettings, settingBool } from '../cms/service';
import * as repo from './repository';

// ---------------------------------------------------------------- constants (docs/07 §2, §4)

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SESSION_POLICY: Record<Audience, { idleMs: number; absoluteMs: number }> = {
  admin: { idleMs: 2 * HOUR, absoluteMs: 12 * HOUR },
  portal: { idleMs: 24 * HOUR, absoluteMs: 30 * DAY },
};
const TOUCH_INTERVAL_MS = 5 * MINUTE;
const LOCK_AFTER_FAILURES = 10;
const LOCK_DURATION_MS = 15 * MINUTE;
const TURNSTILE_AFTER_FAILURES = 3;
const LOGIN_WINDOW_S = 15 * 60;
export const TOKEN_TTL_MS = {
  password_reset: 1 * HOUR,
  email_verify: 24 * HOUR,
  invite_staff: 7 * DAY,
  invite_client: 7 * DAY,
} as const;

const INVALID_LOGIN = 'Email or password is incorrect.';

// ---------------------------------------------------------------- types

export interface AuthState {
  user: { id: string; email: string; name: string; userType: 'staff' | 'client'; mustChangePassword: boolean };
  session: { id: string; audience: Audience; csrfSecret: string; mfaVerified: boolean; createdAt: string };
  roles: string[];
  permissions: Set<Permission>;
  /** Portal only: clients this user may see (active client_user_access rows). */
  clientIds: string[];
  /** Portal only: the access role per client (owner sees everything; see `portalAreaClientIds`). */
  clientRoles: Record<string, repo.PortalRole>;
  /** enabled: the user has 2FA on; required: their role demands it (super admin, finance manager). */
  mfa: { enabled: boolean; required: boolean };
}

const MFA_REQUIRED_ROLES = ['super_admin', 'finance_manager'];

const KNOWN_DEVICE_DAYS = 180;

/**
 * A sign-in is "new" when the account has signed in before but never from this browser (user agent) in the last
 * 180 days. The very first sign-in (straight after accepting an invitation) is not alerted.
 */
async function isNewDevice(ctx: RequestContext, userId: string): Promise<boolean> {
  const since = new Date(ctx.now().getTime() - KNOWN_DEVICE_DAYS * 86_400_000).toISOString();
  const row = await ctx.db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN user_agent IS ? THEN 1 ELSE 0 END), 0) AS same
       FROM sessions WHERE user_id = ? AND created_at >= ?`,
    )
    .bind(ctx.userAgent, userId, since)
    .first<{ total: number; same: number }>();
  return !!row && row.total > 0 && row.same === 0;
}

export function cookieName(ctx: RequestContext, audience: Audience): string {
  return ctx.config.secureCookies ? `__Host-kz_${audience}` : `kz_${audience}_dev`;
}

const userTypeFor = (audience: Audience) => (audience === 'admin' ? 'staff' : 'client');
const iso = (ms: number) => new Date(ms).toISOString();

// ---------------------------------------------------------------- sessions

async function newSession(ctx: RequestContext, userId: string, audience: Audience, mfaVerified: boolean) {
  const token = randomToken(32);
  const now = ctx.now().getTime();
  const row = {
    id: newId('ses', now),
    user_id: userId,
    token_hash: await sha256Hex(token),
    audience,
    csrf_secret: randomToken(32),
    mfa_verified: mfaVerified ? 1 : 0,
    ip: ctx.ip,
    user_agent: ctx.userAgent,
    created_at: iso(now),
    last_seen_at: iso(now),
    expires_at: iso(now + SESSION_POLICY[audience].absoluteMs),
  };
  return { token, row, stmt: repo.insertSessionStmt(ctx.db, row) };
}

export function sessionCookie(ctx: RequestContext, audience: Audience, token: string): string {
  return serializeCookie(cookieName(ctx, audience), token, {
    secure: ctx.config.secureCookies,
    maxAgeSeconds: SESSION_POLICY[audience].absoluteMs / 1000,
  });
}

export function clearSessionCookie(ctx: RequestContext, audience: Audience): string {
  return clearCookie(cookieName(ctx, audience), ctx.config.secureCookies);
}

/** Resolves the session cookie for an audience. Returns null for missing, expired, idle, revoked or wrong-audience sessions. */
export async function resolveSession(
  ctx: RequestContext,
  cookieHeader: string | null,
  audience: Audience,
): Promise<AuthState | null> {
  const token = parseCookies(cookieHeader)[cookieName(ctx, audience)];
  if (!token || token.length > 100) return null;
  const session = await repo.findSessionByTokenHash(ctx.db, await sha256Hex(token));
  if (!session || session.audience !== audience || session.revoked_at) return null;
  const now = ctx.now().getTime();
  if (Date.parse(session.expires_at) <= now) return null;
  if (Date.parse(session.last_seen_at) + SESSION_POLICY[audience].idleMs <= now) return null;
  const user = await repo.findUserById(ctx.db, session.user_id);
  if (!user || user.status !== 'active' || user.user_type !== userTypeFor(audience)) return null;

  if (now - Date.parse(session.last_seen_at) >= TOUCH_INTERVAL_MS) {
    ctx.waitUntil(repo.touchSessionStmt(ctx.db, session.id, iso(now)).run());
  }
  const roles = audience === 'admin' ? await repo.roleKeysForUser(ctx.db, user.id) : [];
  const permissions = new Set<Permission>(
    roles.includes('super_admin')
      ? ALL_PERMISSIONS
      : audience === 'admin'
        ? (await repo.permissionKeysForUser(ctx.db, user.id)).filter(isPermission)
        : [],
  );
  const access = audience === 'portal' ? await repo.activeClientAccess(ctx.db, user.id) : [];
  const clientIds = access.map((a) => a.client_id);
  const clientRoles = Object.fromEntries(access.map((a) => [a.client_id, a.role]));
  const mfaRow = await ctx.db
    .prepare('SELECT enabled_at FROM user_mfa WHERE user_id = ?')
    .bind(user.id)
    .first<{ enabled_at: string | null }>();
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.user_type,
      mustChangePassword: user.must_change_password === 1,
    },
    session: {
      id: session.id,
      audience,
      csrfSecret: session.csrf_secret,
      mfaVerified: session.mfa_verified === 1,
      createdAt: session.created_at,
    },
    roles,
    permissions,
    clientIds,
    clientRoles,
    mfa: { enabled: !!mfaRow?.enabled_at, required: roles.some((r) => MFA_REQUIRED_ROLES.includes(r)) },
  };
}

// ---------------------------------------------------------------- CSRF + Origin (docs/07 §3)

export function csrfToken(auth: Pick<AuthState, 'session'>): Promise<string> {
  return hmacSha256Base64Url(auth.session.csrfSecret, auth.session.id);
}

export async function verifyCsrf(
  auth: Pick<AuthState, 'session'>,
  provided: string | null | undefined,
): Promise<boolean> {
  if (!provided) return false;
  return timingSafeEqualString(await csrfToken(auth), provided);
}

/** The request's Origin (or Referer origin) must equal PUBLIC_SITE_URL's origin. */
export function originAllowed(ctx: RequestContext, headers: Headers): boolean {
  const origin = headers.get('origin');
  if (origin) return origin === ctx.config.siteOrigin;
  const referer = headers.get('referer');
  if (!referer) return false;
  try {
    return new URL(referer).origin === ctx.config.siteOrigin;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- login / logout

export interface LoginResult {
  token: string;
  cookie: string;
  user: { id: string; email: string; name: string };
  mustChangePassword: boolean;
  /** The user must enter a 2FA code before using the app. */
  mfaRequired: boolean;
  /** The user's role requires 2FA and it isn't set up yet: enrolment comes first. */
  mfaEnrolmentRequired: boolean;
}

export async function login(
  ctx: RequestContext,
  audience: Audience,
  input: { email: string; password: string; turnstileToken?: string | undefined },
): Promise<LoginResult> {
  const email = input.email.toLowerCase();
  await enforce(ctx, { key: `login:email:${email}`, limit: 5, windowSeconds: LOGIN_WINDOW_S });
  await enforce(ctx, { key: `login:ip:${ctx.ip}`, limit: 20, windowSeconds: LOGIN_WINDOW_S });

  const failKey = `login-fail:${email}`;
  if ((await peek(ctx, { key: failKey, windowSeconds: LOGIN_WINDOW_S })) >= TURNSTILE_AFTER_FAILURES) {
    if (!(await verifyTurnstile(ctx, input.turnstileToken))) {
      throw validationError(
        { turnstile: ['Complete the security check to continue.'] },
        'Complete the security check to continue.',
      );
    }
  }

  const user = await repo.findUserByEmail(ctx.db, email);
  const check = await verifyPassword(input.password, user?.password_hash);
  const now = ctx.now();
  const nowIso = now.toISOString();
  const locked = !!user?.locked_until && Date.parse(user.locked_until) > now.getTime();
  const eligible = !!user && user.status === 'active' && user.user_type === userTypeFor(audience) && !locked;

  if (!user || !check.valid || !eligible) {
    await hit(ctx, { key: failKey, limit: 0, windowSeconds: LOGIN_WINDOW_S });
    const batch = new Batch(ctx.db).add(
      auditStmt(ctx, {
        action: 'auth.login_failed',
        entityType: user ? 'user' : undefined,
        entityId: user?.id,
        after: {
          audience,
          reason: !user ? 'unknown_email' : locked ? 'locked' : !check.valid ? 'bad_password' : 'not_eligible',
        },
        actorType: 'public',
        actorUserId: null,
      }),
    );
    if (user && !check.valid && !locked) {
      batch.add(
        repo.loginFailureStmt(ctx.db, user.id, nowIso, LOCK_AFTER_FAILURES, iso(now.getTime() + LOCK_DURATION_MS)),
      );
      if (user.failed_login_count + 1 === LOCK_AFTER_FAILURES) {
        batch.add(
          auditStmt(ctx, {
            action: 'auth.account_locked',
            entityType: 'user',
            entityId: user.id,
            actorType: 'system',
            actorUserId: null,
          }),
        );
      }
    }
    await batch.run();
    throw unauthenticated(INVALID_LOGIN);
  }

  const session = await newSession(ctx, user.id, audience, false);
  const alert = (await isNewDevice(ctx, user.id)) ? securityEmail(ctx, user, 'new_login', session.row.id) : null;
  const batch = new Batch(ctx.db)
    .add(session.stmt)
    .addAll(alert ? [alert.stmt, alert.notice] : [])
    .add(repo.loginSuccessStmt(ctx.db, user.id, nowIso))
    .add(
      auditStmt(ctx, {
        action: 'auth.login_succeeded',
        entityType: 'user',
        entityId: user.id,
        after: { audience, sessionId: session.row.id },
        actorType: audience === 'admin' ? 'staff' : 'client',
        actorUserId: user.id,
      }),
    );
  if (check.needsRehash) batch.add(repo.rehashStmt(ctx.db, user.id, await hashPassword(input.password)));
  await batch.run();
  if (alert) dispatch(ctx, [alert.id]);
  await ctx.db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(failKey).run();

  const mfaRow = await ctx.db
    .prepare('SELECT enabled_at FROM user_mfa WHERE user_id = ?')
    .bind(user.id)
    .first<{ enabled_at: string | null }>();
  const roles = audience === 'admin' ? await repo.roleKeysForUser(ctx.db, user.id) : [];
  return {
    token: session.token,
    cookie: sessionCookie(ctx, audience, session.token),
    user: { id: user.id, email: user.email, name: user.name },
    mustChangePassword: user.must_change_password === 1,
    mfaRequired: !!mfaRow?.enabled_at,
    mfaEnrolmentRequired: !mfaRow?.enabled_at && roles.some((r) => MFA_REQUIRED_ROLES.includes(r)),
  };
}

export async function logout(ctx: RequestContext, auth: AuthState): Promise<string> {
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(repo.revokeSessionStmt(ctx.db, auth.session.id, now))
    .add(auditStmt(ctx, { action: 'auth.logout', entityType: 'session', entityId: auth.session.id }))
    .run();
  return clearSessionCookie(ctx, auth.session.audience);
}

export async function logoutEverywhere(ctx: RequestContext, auth: AuthState): Promise<string> {
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(repo.revokeUserSessionsStmt(ctx.db, auth.user.id, now))
    .add(auditStmt(ctx, { action: 'auth.logout_all', entityType: 'user', entityId: auth.user.id }))
    .run();
  return clearSessionCookie(ctx, auth.session.audience);
}

export async function listSessions(ctx: RequestContext, auth: AuthState) {
  const rows = await repo.listActiveSessions(ctx.db, auth.user.id, auth.session.audience, ctx.now().toISOString());
  return rows.map((s) => ({
    id: s.id,
    current: s.id === auth.session.id,
    ip: s.ip,
    userAgent: s.user_agent,
    createdAt: s.created_at,
    lastSeenAt: s.last_seen_at,
  }));
}

export async function revokeOwnSession(ctx: RequestContext, auth: AuthState, sessionId: string): Promise<void> {
  const result = await ctx.db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(ctx.now().toISOString(), sessionId, auth.user.id)
    .run();
  if (!result.meta.changes) throw new AppError('NOT_FOUND');
  await auditStmt(ctx, { action: 'auth.session_revoked', entityType: 'session', entityId: sessionId }).run();
}

/** Admin action: revoke every session of another user (effective immediately). */
export async function revokeAllSessionsOf(ctx: RequestContext, userId: string): Promise<void> {
  await new Batch(ctx.db)
    .add(repo.revokeUserSessionsStmt(ctx.db, userId, ctx.now().toISOString()))
    .add(auditStmt(ctx, { action: 'auth.sessions_revoked_by_admin', entityType: 'user', entityId: userId }))
    .run();
}

// ---------------------------------------------------------------- passwords

function assertPolicy(password: string, user: { email: string; name?: string }): void {
  const problem = passwordProblem(password, user);
  if (problem) throw validationError({ password: [problem] }, problem);
}

const SECURITY_TITLES: Record<string, string> = {
  password_changed: 'Your password was changed',
  password_reset: 'Your password was reset',
  new_login: 'New sign-in to your account',
  mfa_changed: 'Two-factor authentication settings changed',
};

/** The security_alert email plus the matching in-app notice (always on), for the caller's batch. */
function securityEmail(
  ctx: RequestContext,
  user: { id: string; email: string; name: string; user_type?: 'staff' | 'client' },
  event: string,
  key: string,
) {
  const notice = notifySecurity(ctx, user.id, {
    title: SECURITY_TITLES[event] ?? 'Security alert',
    body: `${ctx.ip ? `From IP ${ctx.ip}. ` : ''}If this wasn't you, reset your password straight away.`,
    link: user.user_type === 'client' ? '/portal/account' : '/admin/account/security',
    dedupeKey: `security:${event}:${key}`,
  });
  const job = enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'security_alert',
      to: user.email,
      data: { name: user.name, event, at: ctx.now().toISOString(), ip: ctx.ip },
    },
    idempotencyKey: `email:security:${event}:${user.id}:${key}`,
  });
  return { ...job, notice };
}

/** Changes the signed-in user's password, rotates their session and revokes all others. Returns a new cookie. */
export async function changePassword(
  ctx: RequestContext,
  auth: AuthState,
  input: { currentPassword: string; newPassword: string },
): Promise<string> {
  const user = await repo.findUserById(ctx.db, auth.user.id);
  if (!user) throw unauthenticated();
  const check = await verifyPassword(input.currentPassword, user.password_hash);
  if (!check.valid) throw validationError({ currentPassword: ['Your current password is incorrect.'] });
  if (input.currentPassword === input.newPassword)
    throw validationError({ newPassword: ['Choose a different password.'] });
  assertPolicy(input.newPassword, user);

  const now = ctx.now().toISOString();
  const session = await newSession(ctx, user.id, auth.session.audience, auth.session.mfaVerified);
  const email = securityEmail(ctx, user, 'password_changed', session.row.id);
  await new Batch(ctx.db)
    .add(repo.setPasswordStmt(ctx.db, user.id, await hashPassword(input.newPassword), now))
    .add(repo.revokeUserSessionsStmt(ctx.db, user.id, now))
    .add(session.stmt)
    .add(auditStmt(ctx, { action: 'auth.password_changed', entityType: 'user', entityId: user.id }))
    .add(email.stmt)
    .add(email.notice)
    .run();
  dispatch(ctx, [email.id]);
  return sessionCookie(ctx, auth.session.audience, session.token);
}

/** Always resolves without revealing whether the account exists (docs/07 §4). */
export async function requestPasswordReset(
  ctx: RequestContext,
  audience: Audience,
  input: { email: string; turnstileToken?: string | undefined },
): Promise<void> {
  const email = input.email.toLowerCase();
  await enforce(ctx, { key: `reset:ip:${ctx.ip}`, limit: 10, windowSeconds: 3600 });
  if (!(await verifyTurnstile(ctx, input.turnstileToken))) {
    throw validationError({ turnstile: ['Complete the security check to continue.'] });
  }
  const perEmail = await hit(ctx, { key: `reset:email:${email}`, limit: 3, windowSeconds: 3600 });
  if (perEmail > 3) return;
  const user = await repo.findUserByEmail(ctx.db, email);
  if (!user || user.status !== 'active' || user.user_type !== userTypeFor(audience)) return;

  const token = randomToken(32);
  const now = ctx.now().getTime();
  const tokenId = newId('tok', now);
  const link = new URL(`/${audience}/reset-password?token=${encodeURIComponent(token)}`, ctx.config.siteUrl).toString();
  const email$ = enqueue(ctx, {
    type: 'email.send',
    payload: { template: 'password_reset', to: user.email, data: { name: user.name, link, expiresInMinutes: 60 } },
    idempotencyKey: `email:password_reset:${tokenId}`,
  });
  await new Batch(ctx.db)
    .add(repo.expireOpenTokensStmt(ctx.db, user.id, 'password_reset', iso(now)))
    .add(
      repo.insertAuthTokenStmt(ctx.db, {
        id: tokenId,
        user_id: user.id,
        email: user.email,
        purpose: 'password_reset',
        token_hash: await sha256Hex(token),
        expires_at: iso(now + TOKEN_TTL_MS.password_reset),
        metadata: JSON.stringify({ audience }),
        created_by: null,
        created_at: iso(now),
      }),
    )
    .add(
      auditStmt(ctx, {
        action: 'auth.password_reset_requested',
        entityType: 'user',
        entityId: user.id,
        actorType: 'public',
      }),
    )
    .add(email$.stmt)
    .run();
  dispatch(ctx, [email$.id]);
}

async function loadToken(ctx: RequestContext, token: string, purposes: repo.AuthTokenRow['purpose'][]) {
  const row = await repo.findAuthTokenByHash(ctx.db, await sha256Hex(token));
  const invalid = () => validationError({ token: ['This link is invalid or has expired. Request a new one.'] });
  if (!row || !purposes.includes(row.purpose) || row.used_at || Date.parse(row.expires_at) <= ctx.now().getTime())
    throw invalid();
  return { row, invalid };
}

export async function resetPassword(ctx: RequestContext, input: { token: string; password: string }): Promise<void> {
  const { row, invalid } = await loadToken(ctx, input.token, ['password_reset']);
  const user = row.user_id ? await repo.findUserById(ctx.db, row.user_id) : null;
  if (!user || user.status !== 'active') throw invalid();
  assertPolicy(input.password, user);
  const now = ctx.now().toISOString();
  const email = securityEmail(ctx, user, 'password_reset', row.id);
  const result = await new Batch(ctx.db)
    .add(repo.useAuthTokenStmt(ctx.db, row.id, now), 'use')
    .add(repo.setPasswordStmt(ctx.db, user.id, await hashPassword(input.password), now))
    .add(repo.revokeUserSessionsStmt(ctx.db, user.id, now))
    .add(auditStmt(ctx, { action: 'auth.password_reset', entityType: 'user', entityId: user.id, actorType: 'public' }))
    .add(email.stmt)
    .add(email.notice)
    .run()
    .catch((err: unknown) => {
      throw err;
    });
  if (result.changes('use') !== 1) throw invalid();
  dispatch(ctx, [email.id]);
}

// ---------------------------------------------------------------- email verification

export async function sendEmailVerification(ctx: RequestContext, auth: AuthState): Promise<void> {
  await enforce(ctx, { key: `verify:user:${auth.user.id}`, limit: 3, windowSeconds: 3600 });
  const token = randomToken(32);
  const now = ctx.now().getTime();
  const tokenId = newId('tok', now);
  const link = new URL(
    `/${auth.session.audience}/verify-email?token=${encodeURIComponent(token)}`,
    ctx.config.siteUrl,
  ).toString();
  const email = enqueue(ctx, {
    type: 'email.send',
    payload: { template: 'email_verification', to: auth.user.email, data: { name: auth.user.name, link } },
    idempotencyKey: `email:email_verify:${tokenId}`,
  });
  await new Batch(ctx.db)
    .add(repo.expireOpenTokensStmt(ctx.db, auth.user.id, 'email_verify', iso(now)))
    .add(
      repo.insertAuthTokenStmt(ctx.db, {
        id: tokenId,
        user_id: auth.user.id,
        email: auth.user.email,
        purpose: 'email_verify',
        token_hash: await sha256Hex(token),
        expires_at: iso(now + TOKEN_TTL_MS.email_verify),
        metadata: null,
        created_by: auth.user.id,
        created_at: iso(now),
      }),
    )
    .add(email.stmt)
    .run();
  dispatch(ctx, [email.id]);
}

export async function verifyEmail(ctx: RequestContext, token: string): Promise<void> {
  const { row, invalid } = await loadToken(ctx, token, ['email_verify']);
  const now = ctx.now().toISOString();
  const result = await new Batch(ctx.db)
    .add(repo.useAuthTokenStmt(ctx.db, row.id, now), 'use')
    .sql(
      'UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ? AND email = ?',
      now,
      now,
      row.user_id,
      row.email,
    )
    .add(
      auditStmt(ctx, {
        action: 'auth.email_verified',
        entityType: 'user',
        entityId: row.user_id ?? undefined,
        actorType: 'public',
      }),
    )
    .run();
  if (result.changes('use') !== 1) throw invalid();
}

// ---------------------------------------------------------------- invitations

export interface InvitationInput {
  kind: 'staff' | 'client';
  email: string;
  name: string;
  /** Staff: role keys to grant. */
  roles?: string[];
  /** Client: which client and access role. */
  clientId?: string;
  accessRole?: 'owner' | 'member' | 'billing';
}

/**
 * Creates (or reuses) an invited user and a single-use invite token. Returns the raw token so the caller's email can
 * carry the link. Matching emails never auto-link to clients: the explicit clientId comes from an admin action.
 */
export async function buildInvitation(ctx: RequestContext, input: InvitationInput, createdBy: string | null) {
  const email = input.email.toLowerCase();
  const now = ctx.now().getTime();
  const userType = input.kind === 'staff' ? 'staff' : 'client';
  const existing = await repo.findUserByEmail(ctx.db, email);
  if (existing && existing.user_type !== userType) {
    throw validationError({ email: ['This email belongs to a different kind of account.'] });
  }
  if (existing && existing.status === 'active' && input.kind === 'staff') {
    throw validationError({ email: ['This person already has an active staff account.'] });
  }
  const userId = existing?.id ?? newId('usr', now);
  const token = randomToken(32);
  const tokenId = newId('tok', now);
  const purpose = input.kind === 'staff' ? 'invite_staff' : 'invite_client';
  const stmts: D1PreparedStatement[] = [];
  if (!existing) {
    stmts.push(
      ctx.db
        .prepare(
          "INSERT INTO users (id, email, name, user_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'invited', ?, ?)",
        )
        .bind(userId, email, input.name, userType, iso(now), iso(now)),
    );
  }
  for (const role of input.roles ?? []) {
    stmts.push(
      ctx.db
        .prepare(
          'INSERT OR IGNORE INTO user_roles (user_id, role_id, granted_by, granted_at) SELECT ?, id, ?, ? FROM roles WHERE key = ?',
        )
        .bind(userId, createdBy, iso(now), role),
    );
  }
  if (input.kind === 'client') {
    if (!input.clientId) throw validationError({ clientId: ['Choose the client this person belongs to.'] });
    stmts.push(
      ctx.db
        .prepare(
          `INSERT INTO client_user_access (id, client_id, user_id, role, status, approved_by, approved_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
           ON CONFLICT(client_id, user_id) DO UPDATE SET role = excluded.role, status = CASE WHEN client_user_access.status = 'active' THEN 'active' ELSE 'pending' END, updated_at = excluded.updated_at`,
        )
        .bind(
          newId('cua', now),
          input.clientId,
          userId,
          input.accessRole ?? 'member',
          createdBy,
          iso(now),
          iso(now),
          iso(now),
        ),
    );
  }
  stmts.push(repo.expireOpenTokensStmt(ctx.db, userId, purpose, iso(now)));
  stmts.push(
    repo.insertAuthTokenStmt(ctx.db, {
      id: tokenId,
      user_id: userId,
      email,
      purpose,
      token_hash: await sha256Hex(token),
      expires_at: iso(now + TOKEN_TTL_MS[purpose]),
      metadata: JSON.stringify(
        input.kind === 'client'
          ? { clientId: input.clientId, role: input.accessRole ?? 'member' }
          : { roles: input.roles ?? [] },
      ),
      created_by: createdBy,
      created_at: iso(now),
    }),
  );
  stmts.push(
    auditStmt(ctx, {
      action: input.kind === 'staff' ? 'user.invited' : 'client.portal_invited',
      entityType: 'user',
      entityId: userId,
      after: { email, roles: input.roles, clientId: input.clientId, accessRole: input.accessRole },
    }),
  );
  const audience = input.kind === 'staff' ? 'admin' : 'portal';
  const link = new URL(`/${audience}/accept-invite?token=${encodeURIComponent(token)}`, ctx.config.siteUrl).toString();
  return { userId, tokenId, token, link, statements: stmts };
}

/** Invites a person and emails them the link (used by the users and clients modules). */
export async function invite(
  ctx: RequestContext,
  input: InvitationInput,
  createdBy: string | null,
): Promise<{ userId: string }> {
  const inv = await buildInvitation(ctx, input, createdBy);
  const email = enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: input.kind === 'staff' ? 'staff_invitation' : 'client_invitation',
      to: input.email.toLowerCase(),
      data: { name: input.name, link: inv.link, expiresInDays: 7 },
    },
    idempotencyKey: `email:invite:${inv.tokenId}`,
  });
  await new Batch(ctx.db).addAll(inv.statements).add(email.stmt).run();
  dispatch(ctx, [email.id]);
  return { userId: inv.userId };
}

export async function acceptInvitation(
  ctx: RequestContext,
  input: { token: string; password: string; name?: string | undefined },
): Promise<{ audience: Audience; userId: string }> {
  const { row, invalid } = await loadToken(ctx, input.token, ['invite_staff', 'invite_client']);
  const user = row.user_id ? await repo.findUserById(ctx.db, row.user_id) : null;
  if (!user || user.status === 'disabled') throw invalid();
  assertPolicy(input.password, user);
  const now = ctx.now().toISOString();
  const audience: Audience = row.purpose === 'invite_staff' ? 'admin' : 'portal';
  const meta = row.metadata
    ? (JSON.parse(row.metadata) as { clientId?: string; registration?: boolean; company?: string })
    : {};
  const batch = new Batch(ctx.db)
    .add(repo.useAuthTokenStmt(ctx.db, row.id, now), 'use')
    .add(repo.setPasswordStmt(ctx.db, user.id, await hashPassword(input.password), now))
    .sql(
      "UPDATE users SET status = 'active', name = COALESCE(?, name), email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?",
      input.name ?? null,
      now,
      now,
      user.id,
    )
    .add(
      auditStmt(ctx, {
        action: 'auth.invitation_accepted',
        entityType: 'user',
        entityId: user.id,
        actorType: audience === 'admin' ? 'staff' : 'client',
        actorUserId: user.id,
      }),
    );
  if (audience === 'portal' && meta.clientId) {
    batch.sql(
      "UPDATE client_user_access SET status = 'active', updated_at = ? WHERE client_id = ? AND user_id = ? AND status = 'pending'",
      now,
      meta.clientId,
      user.id,
    );
  }
  if (audience === 'portal' && meta.registration) {
    // A completed self-registration: staff decide which client (if any) it belongs to. Never linked automatically.
    const name = input.name ?? user.name;
    batch
      .add(
        auditStmt(ctx, {
          action: 'auth.registration_completed',
          entityType: 'user',
          entityId: user.id,
          after: { email: user.email, company: meta.company ?? null },
          actorType: 'client',
          actorUserId: user.id,
        }),
      )
      .add(
        notifyStaffWithPermission(ctx, 'clients.view', {
          type: 'client.registered',
          title: `New portal sign-up: ${name}`,
          body: `${user.email}${meta.company ? ` (${meta.company})` : ''} created a portal account. Link it to a client so they can see their documents.`,
          link: '/admin/clients/portal-signups',
          entityType: 'user',
          entityId: user.id,
          dedupeKey: `client.registered:${user.id}`,
        }),
      );
  }
  const result = await batch.run();
  assertChanges(result.get('use'), 1, 'This link is invalid or has expired. Request a new one.');
  return { audience, userId: user.id };
}

// ---------------------------------------------------------------- portal self-registration (PRD §5)

const REGISTERED_MESSAGE =
  'Thanks. If this email can be used, we have sent a link to finish setting up your account. It expires in 24 hours.';

export async function portalRegistrationEnabled(ctx: RequestContext): Promise<boolean> {
  return settingBool(await getSettings(ctx), 'portal.self_registration', false);
}

/**
 * Starts a self-registration: the person gets an email with a link to choose their password (the password is set
 * only by whoever controls the inbox, so nobody can pre-create an account for someone else's email). The reply is the
 * same whether or not the email is already known. The finished account belongs to no client until staff link it.
 */
export async function registerPortalAccount(
  ctx: RequestContext,
  input: { name: string; company?: string | undefined; email: string; turnstileToken?: string | undefined },
): Promise<{ message: string }> {
  if (!(await portalRegistrationEnabled(ctx))) throw notFound();
  const email = input.email.toLowerCase();
  await enforce(ctx, { key: `register:ip:${ctx.ip}`, limit: 5, windowSeconds: 3600 });
  if (!(await verifyTurnstile(ctx, input.turnstileToken))) {
    throw validationError(
      { turnstile: ['Complete the security check to continue.'] },
      'Complete the security check to continue.',
    );
  }
  await enforce(ctx, { key: `register:email:${email}`, limit: 3, windowSeconds: 3600 });

  const existing = await repo.findUserByEmail(ctx.db, email);
  const pendingSignup =
    existing &&
    existing.user_type === 'client' &&
    existing.status === 'invited' &&
    !existing.password_hash &&
    !(await ctx.db.prepare('SELECT 1 FROM client_user_access WHERE user_id = ?').bind(existing.id).first());
  // Known accounts (and people already invited by staff) get nothing new: no enumeration, no duplicate accounts.
  if (existing && !pendingSignup) {
    await auditStmt(ctx, {
      action: 'auth.registration_ignored',
      entityType: 'user',
      entityId: existing.id,
      actorType: 'public',
      actorUserId: null,
    }).run();
    return { message: REGISTERED_MESSAGE };
  }

  const now = ctx.now().getTime();
  const userId = existing?.id ?? newId('usr', now);
  const token = randomToken(32);
  const tokenId = newId('tok', now);
  const company = input.company?.trim() || undefined;
  const link = new URL(`/portal/accept-invite?token=${encodeURIComponent(token)}`, ctx.config.siteUrl).toString();
  const job = enqueue(ctx, {
    type: 'email.send',
    payload: { template: 'email_verification', to: email, data: { name: input.name, link } },
    idempotencyKey: `email:register:${tokenId}`,
  });
  const batch = new Batch(ctx.db);
  if (!existing) {
    batch.sql(
      "INSERT INTO users (id, email, name, user_type, status, created_at, updated_at) VALUES (?, ?, ?, 'client', 'invited', ?, ?)",
      userId,
      email,
      input.name,
      iso(now),
      iso(now),
    );
  } else {
    batch.sql(
      'UPDATE users SET name = ?, updated_at = ? WHERE id = ? AND password_hash IS NULL',
      input.name,
      iso(now),
      userId,
    );
  }
  await batch
    .add(repo.expireOpenTokensStmt(ctx.db, userId, 'invite_client', iso(now)))
    .add(
      repo.insertAuthTokenStmt(ctx.db, {
        id: tokenId,
        user_id: userId,
        email,
        purpose: 'invite_client',
        token_hash: await sha256Hex(token),
        expires_at: iso(now + TOKEN_TTL_MS.email_verify),
        metadata: JSON.stringify({ registration: true, ...(company ? { company } : {}) }),
        created_by: null,
        created_at: iso(now),
      }),
    )
    .add(
      auditStmt(ctx, {
        action: 'auth.registration_started',
        entityType: 'user',
        entityId: userId,
        after: { email, company: company ?? null },
        actorType: 'public',
        actorUserId: null,
      }),
    )
    .add(job.stmt)
    .run();
  dispatch(ctx, [job.id]);
  return { message: REGISTERED_MESSAGE };
}

// ---------------------------------------------------------------- own profile

export async function updateProfile(
  ctx: RequestContext,
  auth: AuthState,
  input: { name: string; phone: string },
): Promise<void> {
  const before = await repo.findUserById(ctx.db, auth.user.id);
  if (!before) throw unauthenticated();
  const now = ctx.now().toISOString();
  const phone = input.phone.trim() || null;
  await new Batch(ctx.db)
    .sql('UPDATE users SET name = ?, phone = ?, updated_at = ? WHERE id = ?', input.name, phone, now, auth.user.id)
    .add(
      auditStmt(ctx, {
        action: 'user.profile_updated',
        entityType: 'user',
        entityId: auth.user.id,
        before: { name: before.name, phone: before.phone },
        after: { name: input.name, phone },
      }),
    )
    .run();
}
