import { Hono } from 'hono';
import {
  inviteStaffSchema,
  roleSchema,
  setRolesSchema,
  staffListQuery,
  updateRoleSchema,
  updateStaffSchema,
} from '../../../shared/schemas/users';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import { adminReset } from '../mfa';
import { createRole, deleteRole, listRoles, updateRole } from './roles';
import {
  disableUser,
  enableUser,
  getStaff,
  inviteStaff,
  listStaff,
  renameStaff,
  resendInvitation,
  setUserRoles,
} from './service';

/** Staff user administration (P4.2). Every handler re-checks permissions in the service layer. */
export function userRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('users.view'), async (c) =>
    c.json({ data: await listStaff(c.var.ctx, query(c, staffListQuery)) }),
  );
  r.post('/', requirePermission('users.manage'), async (c) =>
    c.json({ data: await inviteStaff(c.var.ctx, await jsonBody(c, inviteStaffSchema)) }, 201),
  );
  r.get('/:id', requirePermission('users.view'), async (c) =>
    c.json({ data: await getStaff(c.var.ctx, c.req.param('id')) }),
  );
  r.patch('/:id', requirePermission('users.manage'), async (c) => {
    await renameStaff(c.var.ctx, c.req.param('id'), (await jsonBody(c, updateStaffSchema)).name);
    return c.json({ data: { ok: true } });
  });
  r.put('/:id/roles', requirePermission('users.manage'), async (c) => {
    await setUserRoles(c.var.ctx, c.req.param('id'), (await jsonBody(c, setRolesSchema)).roles);
    return c.json({ data: { ok: true } });
  });
  r.post('/:id/disable', requirePermission('users.manage'), async (c) => {
    await disableUser(c.var.ctx, c.req.param('id'));
    return c.json({ data: { ok: true } });
  });
  r.post('/:id/enable', requirePermission('users.manage'), async (c) => {
    await enableUser(c.var.ctx, c.req.param('id'));
    return c.json({ data: { ok: true } });
  });
  r.post('/:id/invitation', requirePermission('users.manage'), async (c) => {
    await resendInvitation(c.var.ctx, c.req.param('id'));
    return c.json({ data: { ok: true } });
  });
  r.post('/:id/mfa/reset', requirePermission('users.manage'), async (c) => {
    await adminReset(c.var.ctx, c.req.param('id'));
    return c.json({ data: { ok: true } });
  });
  return r;
}

export function roleRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('users.view'), async (c) => c.json({ data: await listRoles(c.var.ctx) }));
  r.post('/', requirePermission('roles.manage'), async (c) =>
    c.json({ data: await createRole(c.var.ctx, await jsonBody(c, roleSchema)) }, 201),
  );
  r.put('/:id', requirePermission('roles.manage'), async (c) => {
    await updateRole(c.var.ctx, c.req.param('id'), await jsonBody(c, updateRoleSchema));
    return c.json({ data: { ok: true } });
  });
  r.delete('/:id', requirePermission('roles.manage'), async (c) => {
    await deleteRole(c.var.ctx, c.req.param('id'));
    return c.json({ data: { ok: true } });
  });
  return r;
}
