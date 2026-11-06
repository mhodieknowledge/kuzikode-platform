import { Hono } from 'hono';
import { z } from 'zod';
import { activitySchema, enquiryListQuery, leadListQuery, leadSchema } from '../../../shared/schemas/leads';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as admin from './admin';

const ok = { data: { ok: true } };

export function enquiryAdminRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('enquiries.view'), async (c) =>
    c.json({ data: await admin.listEnquiries(c.var.ctx, query(c, enquiryListQuery)) }),
  );
  r.get('/:id', requirePermission('enquiries.view'), async (c) =>
    c.json({ data: await admin.getEnquiry(c.var.ctx, c.req.param('id')) }),
  );
  r.post('/:id/status', requirePermission('enquiries.manage'), async (c) => {
    const { status } = await jsonBody(c, z.object({ status: z.enum(['new', 'spam', 'closed']) }).strict());
    await admin.setEnquiryStatus(c.var.ctx, c.req.param('id'), status);
    return c.json(ok);
  });
  r.post('/:id/lead', requirePermission('leads.manage'), async (c) => {
    const body = await jsonBody(
      c,
      z
        .object({
          assignedTo: z
            .string()
            .regex(/^usr_[A-Za-z0-9_]+$/)
            .nullable()
            .optional(),
        })
        .strict(),
    );
    return c.json(
      { data: await admin.triageToLead(c.var.ctx, c.req.param('id'), { assignedTo: body.assignedTo ?? null }) },
      201,
    );
  });
  return r;
}

export function leadAdminRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('leads.view'), async (c) => {
    const q = query(c, leadListQuery);
    return c.json({ data: await admin.listLeads(c.var.ctx, { ...q, due: q.due === '1' }) });
  });
  r.post('/', requirePermission('leads.manage'), async (c) =>
    c.json({ data: await admin.createLead(c.var.ctx, await jsonBody(c, leadSchema)) }, 201),
  );
  r.get('/:id', requirePermission('leads.view'), async (c) =>
    c.json({ data: await admin.getLead(c.var.ctx, c.req.param('id')) }),
  );
  r.put('/:id', requirePermission('leads.manage'), async (c) => {
    await admin.updateLead(c.var.ctx, c.req.param('id'), await jsonBody(c, leadSchema));
    return c.json(ok);
  });
  r.post('/:id/activities', requirePermission('leads.manage'), async (c) =>
    c.json({ data: await admin.addActivity(c.var.ctx, c.req.param('id'), await jsonBody(c, activitySchema)) }, 201),
  );
  r.post('/:id/activities/:activityId/complete', requirePermission('leads.manage'), async (c) => {
    await admin.completeFollowUp(c.var.ctx, c.req.param('id'), c.req.param('activityId'));
    return c.json(ok);
  });
  r.post('/:id/convert', requirePermission('leads.manage'), async (c) =>
    c.json({ data: await admin.convertLead(c.var.ctx, c.req.param('id')) }, 201),
  );
  return r;
}
