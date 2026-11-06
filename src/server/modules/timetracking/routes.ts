import { Hono } from 'hono';
import { z } from 'zod';
import { billTimeSchema, timeEntrySchema, timeListQuery, timerStartSchema } from '../../../shared/schemas/time';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as svc from './service';

const ok = { data: { ok: true } };
const sheetQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  userId: z
    .string()
    .regex(/^usr_[A-Za-z0-9_]+$/)
    .optional()
    .catch(undefined),
});

/** `/api/v1/admin/time` (P4.23). Permission checks for scope (own vs everyone's) live in the service. */
export function timeRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  const track = requirePermission('time.track');

  r.get('/entries', async (c) => c.json({ data: await svc.listEntries(c.var.ctx, query(c, timeListQuery)) }));
  r.post('/entries', track, async (c) =>
    c.json({ data: await svc.createEntry(c.var.ctx, await jsonBody(c, timeEntrySchema)) }, 201),
  );
  r.put('/entries/:id', track, async (c) => {
    await svc.updateEntry(c.var.ctx, c.req.param('id'), await jsonBody(c, timeEntrySchema));
    return c.json(ok);
  });
  r.delete('/entries/:id', track, async (c) => {
    await svc.deleteEntry(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });

  r.get('/timer', async (c) => c.json({ data: await svc.runningTimer(c.var.ctx) }));
  r.post('/timer/start', track, async (c) =>
    c.json({ data: await svc.startTimer(c.var.ctx, await jsonBody(c, timerStartSchema)) }, 201),
  );
  r.post('/timer/stop', track, async (c) => c.json({ data: await svc.stopTimer(c.var.ctx) }));
  r.post('/timer/discard', track, async (c) => {
    await svc.discardTimer(c.var.ctx);
    return c.json(ok);
  });

  r.get('/timesheet', async (c) => {
    const q = query(c, sheetQuery);
    const date = q.date ?? c.var.ctx.now().toISOString().slice(0, 10);
    return c.json({ data: await svc.timesheet(c.var.ctx, q.userId ?? null, date) });
  });

  r.get('/projects/:id', async (c) => c.json({ data: await svc.projectTime(c.var.ctx, c.req.param('id')) }));
  r.post('/projects/:id/bill', requirePermission('time.bill'), async (c) => {
    const { entryIds } = await jsonBody(c, billTimeSchema);
    return c.json({ data: await svc.billUnbilledTime(c.var.ctx, c.req.param('id'), entryIds) }, 201);
  });
  return r;
}
