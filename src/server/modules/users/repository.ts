import { all, first, stmt } from '../../db/client';

export interface StaffRow {
  id: string;
  email: string;
  name: string;
  status: string;
  last_login_at: string | null;
  roles: string | null;
}

export const findStaff = (db: D1Database, id: string) =>
  first<StaffRow>(
    db,
    `SELECT u.id, u.email, u.name, u.status, u.last_login_at,
       (SELECT group_concat(r.key) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
     FROM users u WHERE u.id = ? AND u.user_type = 'staff'`,
    id,
  );

export const listRoleKeys = async (db: D1Database) =>
  (await all<{ key: string }>(db, 'SELECT key FROM roles')).map((r) => r.key);

/** Active super admins other than `exceptUserId`. */
export const otherActiveSuperAdminsSql = `(SELECT count(*) FROM user_roles ur JOIN users u ON u.id = ur.user_id
  WHERE ur.role_id = 'rol_super_admin' AND u.status = 'active' AND u.id <> ?)`;

/** Removes roles not in `keep`, but never the super_admin role of the last active super admin (guard in SQL). */
export const removeRolesStmt = (db: D1Database, userId: string, keep: string[]) =>
  stmt(
    db,
    `DELETE FROM user_roles WHERE user_id = ?
       AND role_id NOT IN (SELECT id FROM roles WHERE key IN (SELECT value FROM json_each(?)))
       AND (role_id <> 'rol_super_admin' OR ${otherActiveSuperAdminsSql} >= 1)`,
    userId,
    JSON.stringify(keep),
    userId,
  );

export const addRolesStmt = (db: D1Database, userId: string, keys: string[], grantedBy: string | null, now: string) =>
  stmt(
    db,
    `INSERT OR IGNORE INTO user_roles (user_id, role_id, granted_by, granted_at)
     SELECT ?, id, ?, ? FROM roles WHERE key IN (SELECT value FROM json_each(?))`,
    userId,
    grantedBy,
    now,
    JSON.stringify(keys),
  );

/** Disables a staff user unless they are the last active super admin. */
export const disableStaffStmt = (db: D1Database, userId: string, now: string) =>
  stmt(
    db,
    `UPDATE users SET status = 'disabled', updated_at = ? WHERE id = ? AND user_type = 'staff' AND status <> 'disabled'
       AND (NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = 'rol_super_admin') OR ${otherActiveSuperAdminsSql} >= 1)`,
    now,
    userId,
    userId,
    userId,
  );

export const enableStaffStmt = (db: D1Database, userId: string, now: string) =>
  stmt(
    db,
    "UPDATE users SET status = 'active', updated_at = ? WHERE id = ? AND user_type = 'staff' AND status = 'disabled'",
    now,
    userId,
  );
