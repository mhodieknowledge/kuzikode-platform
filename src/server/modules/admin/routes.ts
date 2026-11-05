import { Hono } from 'hono';
import { z } from 'zod';
import { csrfProtect, requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import { listNotifications, markNotificationsRead } from '../notifications';
import { adminSearch } from './search';

const searchQuery = z.object({ q: z.string().max(200).default('') }).strict();
const listQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(100).optional(), unread: z.enum(['1', '0']).optional() })
  .strict();
const markRead = z
  .object({
    ids: z
      .array(z.string().regex(/^ntf_[A-Za-z0-9_]+$/))
      .max(100)
      .default([]),
  })
  .strict();

/** Admin shell APIs (P4.1): global search and the notifications bell. Every staff member may use them. */
export function adminShellRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/search', async (c) => {
    const { q } = query(c, searchQuery);
    return c.json({ data: await adminSearch(c.var.ctx, c.var.ctx.auth!, q) });
  });
  r.get('/notifications', async (c) => {
    const { limit, unread } = query(c, listQuery);
    return c.json({
      data: await listNotifications(c.var.ctx, c.var.ctx.auth!.user.id, { limit, unreadOnly: unread === '1' }),
    });
  });
  r.post('/notifications/read', async (c) => {
    const { ids } = await jsonBody(c, markRead);
    return c.json({ data: { updated: await markNotificationsRead(c.var.ctx, c.var.ctx.auth!.user.id, ids) } });
  });
  return r;
}
