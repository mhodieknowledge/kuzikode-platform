import { Hono } from 'hono';
import { z } from 'zod';
import {
  applicationListQuery,
  applicationNoteSchema,
  applicationUpdateSchema,
  bulkRejectSchema,
  candidateTemplatesSchema,
  CANDIDATE_TEMPLATES,
  emailApplicantSchema,
  postingSchema,
  postingStatusSchema,
} from '../../../shared/schemas/careers-admin';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as svc from './admin';

const ok = { data: { ok: true } };
const draftQuery = z.object({ template: z.enum(CANDIDATE_TEMPLATES) });

/** `/api/v1/admin/careers`: postings and the applicant pipeline (careers.view to read, careers.manage to change). */
export function careersAdminRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect(), requirePermission('careers.view'));
  const manage = requirePermission('careers.manage');
  r.get('/postings', async (c) => c.json({ data: await svc.listPostingsAdmin(c.var.ctx) }));
  r.post('/postings', manage, async (c) =>
    c.json({ data: await svc.createPosting(c.var.ctx, await jsonBody(c, postingSchema)) }, 201),
  );
  r.get('/postings/:id', async (c) => c.json({ data: await svc.getPostingAdmin(c.var.ctx, c.req.param('id')) }));
  r.put('/postings/:id', manage, async (c) => {
    await svc.updatePosting(c.var.ctx, c.req.param('id'), await jsonBody(c, postingSchema));
    return c.json(ok);
  });
  r.post('/postings/:id/status', manage, async (c) => {
    await svc.setPostingStatus(c.var.ctx, c.req.param('id'), (await jsonBody(c, postingStatusSchema)).status);
    return c.json(ok);
  });
  r.post('/postings/:id/duplicate', manage, async (c) =>
    c.json({ data: await svc.duplicatePosting(c.var.ctx, c.req.param('id')) }, 201),
  );

  r.get('/applications', async (c) =>
    c.json({ data: await svc.listApplications(c.var.ctx, query(c, applicationListQuery)) }),
  );
  r.post('/applications/reject', manage, async (c) => {
    const { ids, sendRegret } = await jsonBody(c, bulkRejectSchema);
    return c.json({ data: await svc.bulkReject(c.var.ctx, ids, sendRegret) });
  });
  r.get('/applications/:id', async (c) => c.json({ data: await svc.getApplication(c.var.ctx, c.req.param('id')) }));
  r.patch('/applications/:id', manage, async (c) => {
    await svc.updateApplication(c.var.ctx, c.req.param('id'), await jsonBody(c, applicationUpdateSchema));
    return c.json(ok);
  });
  r.post('/applications/:id/notes', manage, async (c) => {
    await svc.addApplicationNote(c.var.ctx, c.req.param('id'), (await jsonBody(c, applicationNoteSchema)).body);
    return c.json(ok, 201);
  });
  r.get('/applications/:id/email-draft', manage, async (c) =>
    c.json({ data: await svc.draftCandidateEmail(c.var.ctx, c.req.param('id'), query(c, draftQuery).template) }),
  );
  r.post('/applications/:id/email', manage, async (c) => {
    await svc.emailApplicant(c.var.ctx, c.req.param('id'), await jsonBody(c, emailApplicantSchema));
    return c.json(ok, 201);
  });
  r.post('/applications/:id/erase', manage, async (c) => {
    await svc.eraseApplicant(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });

  r.get('/templates', async (c) => c.json({ data: await svc.candidateTemplates(c.var.ctx) }));
  r.put('/templates', manage, async (c) => {
    await svc.saveCandidateTemplates(c.var.ctx, await jsonBody(c, candidateTemplatesSchema));
    return c.json(ok);
  });
  return r;
}
