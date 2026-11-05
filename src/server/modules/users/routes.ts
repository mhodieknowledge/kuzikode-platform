import { Hono } from 'hono';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { adminReset } from '../mfa';

/** Staff user administration. P4.2 adds listing, invites, roles and disable/enable endpoints. */
export function userRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.post('/:id/mfa/reset', requirePermission('users.manage'), async (c) => {
    await adminReset(c.var.ctx, c.req.param('id'));
    return c.json({ data: { ok: true } });
  });
  return r;
}
