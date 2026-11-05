import { all, first, stmt } from '../../db/client';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  user_type: 'staff' | 'client';
  password_hash: string | null;
  status: 'invited' | 'active' | 'disabled';
  must_change_password: number;
  email_verified_at: string | null;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  audience: 'admin' | 'portal';
  csrf_secret: string;
  mfa_verified: number;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface AuthTokenRow {
  id: string;
  user_id: string | null;
  email: string;
  purpose: 'invite_staff' | 'invite_client' | 'password_reset' | 'email_verify';
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  metadata: string | null;
  created_by: string | null;
}

const USER_COLS =
  'id, email, name, phone, user_type, password_hash, status, must_change_password, email_verified_at, failed_login_count, locked_until, last_login_at';

export const findUserByEmail = (db: D1Database, email: string) =>
  first<UserRow>(db, `SELECT ${USER_COLS} FROM users WHERE email = ?`, email);

export const findUserById = (db: D1Database, id: string) =>
  first<UserRow>(db, `SELECT ${USER_COLS} FROM users WHERE id = ?`, id);

export async function roleKeysForUser(db: D1Database, userId: string): Promise<string[]> {
  const rows = await all<{ key: string }>(
    db,
    'SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.key',
    userId,
  );
  return rows.map((r) => r.key);
}

export async function permissionKeysForUser(db: D1Database, userId: string): Promise<string[]> {
  const rows = await all<{ permission_key: string }>(
    db,
    `SELECT DISTINCT rp.permission_key FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id WHERE ur.user_id = ?`,
    userId,
  );
  return rows.map((r) => r.permission_key);
}

export async function activeClientIds(db: D1Database, userId: string): Promise<string[]> {
  const rows = await all<{ client_id: string }>(
    db,
    `SELECT cua.client_id FROM client_user_access cua JOIN clients c ON c.id = cua.client_id
     WHERE cua.user_id = ? AND cua.status = 'active' ORDER BY cua.created_at`,
    userId,
  );
  return rows.map((r) => r.client_id);
}

export const findSessionByTokenHash = (db: D1Database, tokenHash: string) =>
  first<SessionRow>(db, 'SELECT * FROM sessions WHERE token_hash = ?', tokenHash);

export const insertSessionStmt = (db: D1Database, s: Omit<SessionRow, 'revoked_at'>) =>
  stmt(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, audience, csrf_secret, mfa_verified, ip, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id,
    s.user_id,
    s.token_hash,
    s.audience,
    s.csrf_secret,
    s.mfa_verified,
    s.ip,
    s.user_agent,
    s.created_at,
    s.last_seen_at,
    s.expires_at,
  );

export const touchSessionStmt = (db: D1Database, id: string, now: string) =>
  stmt(db, 'UPDATE sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL', now, id);

export const revokeSessionStmt = (db: D1Database, id: string, now: string) =>
  stmt(db, 'UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', now, id);

export const revokeUserSessionsStmt = (
  db: D1Database,
  userId: string,
  now: string,
  exceptSessionId: string | null = null,
) =>
  stmt(
    db,
    'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND (? IS NULL OR id <> ?)',
    now,
    userId,
    exceptSessionId,
    exceptSessionId,
  );

export const listActiveSessions = (db: D1Database, userId: string, audience: string, now: string) =>
  all<SessionRow>(
    db,
    `SELECT * FROM sessions WHERE user_id = ? AND audience = ? AND revoked_at IS NULL AND expires_at > ?
     ORDER BY last_seen_at DESC LIMIT 50`,
    userId,
    audience,
    now,
  );

export const loginSuccessStmt = (db: D1Database, userId: string, now: string) =>
  stmt(
    db,
    'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?',
    now,
    now,
    userId,
  );

/** Increments the failure counter and locks the account when it reaches `lockAfter`. */
export const loginFailureStmt = (db: D1Database, userId: string, now: string, lockAfter: number, lockUntil: string) =>
  stmt(
    db,
    `UPDATE users SET failed_login_count = failed_login_count + 1,
       locked_until = CASE WHEN failed_login_count + 1 >= ? THEN ? ELSE locked_until END, updated_at = ?
     WHERE id = ?`,
    lockAfter,
    lockUntil,
    now,
    userId,
  );

export const setPasswordStmt = (db: D1Database, userId: string, hash: string, now: string, mustChange = 0) =>
  stmt(
    db,
    `UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = ?, failed_login_count = 0,
       locked_until = NULL, updated_at = ? WHERE id = ?`,
    hash,
    now,
    mustChange,
    now,
    userId,
  );

export const rehashStmt = (db: D1Database, userId: string, hash: string) =>
  stmt(db, 'UPDATE users SET password_hash = ? WHERE id = ?', hash, userId);

export const findAuthTokenByHash = (db: D1Database, tokenHash: string) =>
  first<AuthTokenRow>(db, 'SELECT * FROM auth_tokens WHERE token_hash = ?', tokenHash);

export const insertAuthTokenStmt = (db: D1Database, t: Omit<AuthTokenRow, 'used_at'> & { created_at: string }) =>
  stmt(
    db,
    `INSERT INTO auth_tokens (id, user_id, email, purpose, token_hash, expires_at, metadata, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    t.id,
    t.user_id,
    t.email,
    t.purpose,
    t.token_hash,
    t.expires_at,
    t.metadata,
    t.created_by,
    t.created_at,
  );

/** Single-use guard: only succeeds while unused and unexpired. */
export const useAuthTokenStmt = (db: D1Database, id: string, now: string) =>
  stmt(db, 'UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?', now, id, now);

/** Invalidates older unused tokens of the same purpose for a user (e.g. a new reset link replaces the old one). */
export const expireOpenTokensStmt = (db: D1Database, userId: string, purpose: string, now: string) =>
  stmt(
    db,
    'UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL',
    now,
    userId,
    purpose,
  );
