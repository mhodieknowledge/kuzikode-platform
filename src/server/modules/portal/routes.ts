import { Hono } from 'hono';
import { csrfProtect, requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { portalOverview } from './service';

/** `/api/v1/portal/*`: client portal reads and actions, portal sessions only (docs/07 §5). */
export function portalRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('portal'), csrfProtect(), requireAuth('portal'));
  r.get('/overview', async (c) => c.json({ data: await portalOverview(c.var.ctx) }));
  return r;
}
