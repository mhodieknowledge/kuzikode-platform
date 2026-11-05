/** Two-factor authentication: TOTP + backup codes (docs/07 §5b, docs/12 §D). */
import type { RequestContext } from '../../context';
import { Batch } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { decryptString, encryptString, hmacSha256Base64Url, verifyPassword } from '../../lib/crypto';
import { AppError, forbidden, unauthenticated, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan, isSuperAdmin } from '../../lib/policies';
import { enforce } from '../../lib/rate-limit';
import { generateBackupCodes, generateSecret, normalizeBackupCode, otpauthUri, verifyTotp } from '../../lib/totp';
import { dispatch, enqueue } from '../../jobs/outbox';
import type { AuthState } from '../auth/service';

/** Roles that must use 2FA. */
export const MFA_REQUIRED_ROLES = ['super_admin', 'finance_manager'];
const PURPOSE = 'totp-secret';

interface MfaRow {
  user_id: string;
  totp_secret_enc: string;
  enabled_at: string | null;
  last_used_step: number | null;
}

const getRow = (ctx: RequestContext, userId: string) =>
  ctx.db.prepare('SELECT * FROM user_mfa WHERE user_id = ?').bind(userId).first<MfaRow>();

const hashBackup = (ctx: RequestContext, userId: string, code: string) =>
  hmacSha256Base64Url(ctx.config.hmacSecret, `backup:${userId}:${normalizeBackupCode(code)}`);

function needAuth(ctx: RequestContext): AuthState {
  if (!ctx.auth) throw unauthenticated();
  return ctx.auth;
}

export async function mfaStatus(
  ctx: RequestContext,
  userId: string,
): Promise<{ enabled: boolean; required: boolean; backupCodesLeft: number }> {
  const row = await getRow(ctx, userId);
  const left = await ctx.db
    .prepare('SELECT count(*) AS n FROM user_backup_codes WHERE user_id = ? AND used_at IS NULL')
    .bind(userId)
    .first<{ n: number }>();
  const roles = ctx.auth?.user.id === userId ? ctx.auth.roles : [];
  return {
    enabled: !!row?.enabled_at,
    required: roles.some((r) => MFA_REQUIRED_ROLES.includes(r)),
    backupCodesLeft: left?.n ?? 0,
  };
}

/** Starts (or restarts) enrolment: a new pending secret. Not active until confirmed with a valid code. */
export async function startEnrolment(ctx: RequestContext): Promise<{ secret: string; otpauthUri: string }> {
  const auth = needAuth(ctx);
  const existing = await getRow(ctx, auth.user.id);
  if (existing?.enabled_at) throw new AppError('CONFLICT', 'Two-factor authentication is already on.');
  const secret = generateSecret();
  const enc = await encryptString(ctx.config.dataEncryptionKey, secret, PURPOSE);
  const now = ctx.now().toISOString();
  await ctx.db
    .prepare(
      `INSERT INTO user_mfa (user_id, totp_secret_enc, enabled_at, last_used_step, created_at, updated_at) VALUES (?, ?, NULL, NULL, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET totp_secret_enc = excluded.totp_secret_enc, last_used_step = NULL, updated_at = excluded.updated_at
       WHERE user_mfa.enabled_at IS NULL`,
    )
    .bind(auth.user.id, enc, now, now)
    .run();
  return { secret, otpauthUri: otpauthUri(secret, auth.user.email) };
}

function securityEmail(ctx: RequestContext, auth: AuthState, key: string) {
  return enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'security_alert',
      to: auth.user.email,
      data: { name: auth.user.name, event: 'mfa_changed', at: ctx.now().toISOString(), ip: ctx.ip },
    },
    idempotencyKey: `email:security:mfa:${auth.user.id}:${key}`,
  });
}

/** Confirms enrolment with a code. Returns 10 backup codes, shown once. Marks the current session as verified. */
export async function confirmEnrolment(ctx: RequestContext, code: string): Promise<{ backupCodes: string[] }> {
  const auth = needAuth(ctx);
  await enforce(ctx, { key: `mfa:${auth.session.id}`, limit: 10, windowSeconds: 900 });
  const row = await getRow(ctx, auth.user.id);
  if (!row || row.enabled_at) throw new AppError('CONFLICT', 'Start set-up again.');
  const secret = await decryptString(ctx.config.dataEncryptionKey, row.totp_secret_enc, PURPOSE);
  const step = await verifyTotp(secret, code.trim(), ctx.now().getTime(), null);
  if (step === null)
    throw validationError({ code: ['That code is not right. Check the time on your phone and try again.'] });
  const codes = generateBackupCodes();
  const now = ctx.now().toISOString();
  const email = securityEmail(ctx, auth, `enabled:${step}`);
  const batch = new Batch(ctx.db)
    .sql(
      'UPDATE user_mfa SET enabled_at = ?, last_used_step = ?, updated_at = ? WHERE user_id = ? AND enabled_at IS NULL',
      now,
      step,
      now,
      auth.user.id,
    )
    .sql('DELETE FROM user_backup_codes WHERE user_id = ?', auth.user.id)
    .sql('UPDATE sessions SET mfa_verified = 1 WHERE id = ?', auth.session.id)
    .add(auditStmt(ctx, { action: 'auth.mfa_enabled', entityType: 'user', entityId: auth.user.id }))
    .add(email.stmt);
  for (const c of codes) {
    batch.sql(
      'INSERT INTO user_backup_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)',
      newId('bkc'),
      auth.user.id,
      await hashBackup(ctx, auth.user.id, c),
      now,
    );
  }
  await batch.run();
  dispatch(ctx, [email.id]);
  return { backupCodes: codes };
}

/** Second step of sign-in: a TOTP code (replay-protected) or an unused backup code. */
export async function verifySession(ctx: RequestContext, code: string): Promise<{ usedBackupCode: boolean }> {
  const auth = needAuth(ctx);
  await enforce(ctx, { key: `mfa:${auth.session.id}`, limit: 5, windowSeconds: 900 });
  const row = await getRow(ctx, auth.user.id);
  if (!row?.enabled_at) throw new AppError('CONFLICT', 'Two-factor authentication is not on for this account.');
  const now = ctx.now().toISOString();
  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed)) {
    const secret = await decryptString(ctx.config.dataEncryptionKey, row.totp_secret_enc, PURPOSE);
    const step = await verifyTotp(secret, trimmed, ctx.now().getTime(), row.last_used_step);
    if (step !== null) {
      const res = await new Batch(ctx.db)
        .sql(
          'UPDATE user_mfa SET last_used_step = ?, updated_at = ? WHERE user_id = ? AND (last_used_step IS NULL OR last_used_step < ?)',
          step,
          now,
          auth.user.id,
          step,
        )
        .sql('UPDATE sessions SET mfa_verified = 1 WHERE id = ? AND changes() = 1', auth.session.id)
        .add(auditStmt(ctx, { action: 'auth.mfa_verified', entityType: 'user', entityId: auth.user.id }))
        .run();
      if ((res.results[0]?.meta.changes ?? 0) === 1) return { usedBackupCode: false };
    }
  } else {
    const hash = await hashBackup(ctx, auth.user.id, trimmed);
    const res = await new Batch(ctx.db)
      .sql(
        'UPDATE user_backup_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL',
        now,
        auth.user.id,
        hash,
      )
      .sql('UPDATE sessions SET mfa_verified = 1 WHERE id = ? AND changes() = 1', auth.session.id)
      .run();
    if ((res.results[0]?.meta.changes ?? 0) === 1) {
      await auditStmt(ctx, { action: 'auth.mfa_backup_code_used', entityType: 'user', entityId: auth.user.id }).run();
      return { usedBackupCode: true };
    }
  }
  throw validationError({ code: ['That code is not right, or it has already been used.'] });
}

async function assertPasswordAndCode(ctx: RequestContext, auth: AuthState, password: string, code: string) {
  const user = await ctx.db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(auth.user.id)
    .first<{ password_hash: string | null }>();
  if (!(await verifyPassword(password, user?.password_hash)).valid)
    throw validationError({ password: ['Your password is incorrect.'] });
  const row = await getRow(ctx, auth.user.id);
  if (!row?.enabled_at) throw new AppError('CONFLICT', 'Two-factor authentication is not on.');
  const secret = await decryptString(ctx.config.dataEncryptionKey, row.totp_secret_enc, PURPOSE);
  const step = await verifyTotp(secret, code.trim(), ctx.now().getTime(), row.last_used_step);
  if (step === null) throw validationError({ code: ['That code is not right.'] });
  return step;
}

/** Turning 2FA off needs the password and a current code; roles that require 2FA cannot turn it off. */
export async function disable(ctx: RequestContext, input: { password: string; code: string }): Promise<void> {
  const auth = needAuth(ctx);
  await enforce(ctx, { key: `mfa:${auth.session.id}`, limit: 5, windowSeconds: 900 });
  if (auth.roles.some((r) => MFA_REQUIRED_ROLES.includes(r)))
    throw forbidden('Your role requires two-factor authentication.');
  await assertPasswordAndCode(ctx, auth, input.password, input.code);
  const email = securityEmail(ctx, auth, `disabled:${ctx.now().getTime()}`);
  await new Batch(ctx.db)
    .sql('DELETE FROM user_backup_codes WHERE user_id = ?', auth.user.id)
    .sql('DELETE FROM user_mfa WHERE user_id = ?', auth.user.id)
    .add(auditStmt(ctx, { action: 'auth.mfa_disabled', entityType: 'user', entityId: auth.user.id }))
    .add(email.stmt)
    .run();
  dispatch(ctx, [email.id]);
}

export async function regenerateBackupCodes(
  ctx: RequestContext,
  input: { password: string; code: string },
): Promise<{ backupCodes: string[] }> {
  const auth = needAuth(ctx);
  await enforce(ctx, { key: `mfa:${auth.session.id}`, limit: 5, windowSeconds: 900 });
  const step = await assertPasswordAndCode(ctx, auth, input.password, input.code);
  const codes = generateBackupCodes();
  const now = ctx.now().toISOString();
  const batch = new Batch(ctx.db)
    .sql('DELETE FROM user_backup_codes WHERE user_id = ?', auth.user.id)
    .sql('UPDATE user_mfa SET last_used_step = ? WHERE user_id = ?', step, auth.user.id)
    .add(auditStmt(ctx, { action: 'auth.mfa_backup_codes_regenerated', entityType: 'user', entityId: auth.user.id }));
  for (const c of codes) {
    batch.sql(
      'INSERT INTO user_backup_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)',
      newId('bkc'),
      auth.user.id,
      await hashBackup(ctx, auth.user.id, c),
      now,
    );
  }
  await batch.run();
  return { backupCodes: codes };
}

/** Super admin only: remove another user's 2FA (lost phone). Their sessions are revoked; enrolment is forced again if required. */
export async function adminReset(ctx: RequestContext, userId: string): Promise<void> {
  assertCan(ctx, 'users.manage');
  if (!isSuperAdmin(ctx)) throw forbidden('Only a Super Administrator can reset two-factor authentication.');
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .sql('DELETE FROM user_backup_codes WHERE user_id = ?', userId)
    .sql('DELETE FROM user_mfa WHERE user_id = ?', userId)
    .sql('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', now, userId)
    .add(auditStmt(ctx, { action: 'auth.mfa_reset_by_admin', entityType: 'user', entityId: userId }))
    .run();
}
