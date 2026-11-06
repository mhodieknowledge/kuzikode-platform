import { Hono } from 'hono';
import { z } from 'zod';
import {
  fileMetaSchema,
  messageSchema,
  milestoneSchema,
  projectListQuery,
  projectSchema,
  projectSettingsSchema,
  taskMoveSchema,
  taskSchema,
  updateSchema,
} from '../../../shared/schemas/projects';
import { validationError } from '../../lib/errors';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as svc from './service';

const ok = { data: { ok: true } };
const MAX_MULTIPART_BYTES = 11 * 1024 * 1024;
const visibility = z.object({ clientVisible: z.boolean() }).strict();

/** `/api/v1/admin/projects`. Reads are scoped to the caller's projects inside the service. */
export function projectRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', async (c) => c.json({ data: await svc.listProjects(c.var.ctx, query(c, projectListQuery)) }));
  r.post('/', requirePermission('projects.manage'), async (c) =>
    c.json({ data: await svc.createProject(c.var.ctx, await jsonBody(c, projectSchema)) }, 201),
  );
  r.post('/from-quotation/:quotationId', requirePermission('projects.manage'), async (c) => {
    const res = await svc.createFromQuotation(c.var.ctx, c.req.param('quotationId'));
    return c.json({ data: res }, res.created ? 201 : 200);
  });
  r.get('/:id', async (c) => c.json({ data: await svc.getProject(c.var.ctx, c.req.param('id')) }));
  r.put('/:id', requirePermission('projects.manage'), async (c) => {
    await svc.updateProject(c.var.ctx, c.req.param('id'), await jsonBody(c, projectSchema));
    return c.json(ok);
  });
  r.put('/:id/settings', requirePermission('projects.manage'), async (c) => {
    await svc.updateSettings(c.var.ctx, c.req.param('id'), await jsonBody(c, projectSettingsSchema));
    return c.json(ok);
  });

  r.post('/:id/milestones', requirePermission('projects.manage'), async (c) =>
    c.json({ data: await svc.addMilestone(c.var.ctx, c.req.param('id'), await jsonBody(c, milestoneSchema)) }, 201),
  );
  r.put('/:id/milestones/:mid', requirePermission('projects.manage'), async (c) => {
    await svc.updateMilestone(c.var.ctx, c.req.param('id'), c.req.param('mid'), await jsonBody(c, milestoneSchema));
    return c.json(ok);
  });
  r.delete('/:id/milestones/:mid', requirePermission('projects.manage'), async (c) => {
    await svc.deleteMilestone(c.var.ctx, c.req.param('id'), c.req.param('mid'));
    return c.json(ok);
  });

  r.post('/:id/tasks', requirePermission('projects.manage'), async (c) =>
    c.json({ data: await svc.addTask(c.var.ctx, c.req.param('id'), await jsonBody(c, taskSchema)) }, 201),
  );
  r.put('/:id/tasks/:tid', requirePermission('projects.manage'), async (c) => {
    await svc.updateTask(c.var.ctx, c.req.param('id'), c.req.param('tid'), await jsonBody(c, taskSchema));
    return c.json(ok);
  });
  r.post('/:id/tasks/:tid/move', async (c) => {
    const { status } = await jsonBody(c, taskMoveSchema);
    await svc.moveTask(c.var.ctx, c.req.param('id'), c.req.param('tid'), status);
    return c.json(ok);
  });
  r.delete('/:id/tasks/:tid', requirePermission('projects.manage'), async (c) => {
    await svc.deleteTask(c.var.ctx, c.req.param('id'), c.req.param('tid'));
    return c.json(ok);
  });

  r.post('/:id/updates', requirePermission('projects.manage'), async (c) =>
    c.json({ data: await svc.postUpdate(c.var.ctx, c.req.param('id'), await jsonBody(c, updateSchema)) }, 201),
  );
  r.post('/:id/messages', async (c) => {
    const { body } = await jsonBody(c, messageSchema);
    return c.json({ data: await svc.postMessage(c.var.ctx, c.req.param('id'), body) }, 201);
  });

  r.post('/:id/files', requirePermission('projects.manage'), async (c) => {
    if (Number(c.req.header('content-length') ?? '0') > MAX_MULTIPART_BYTES)
      throw validationError({ file: ['Files must be 10 MB or smaller.'] });
    const form = await c.req.formData().catch(() => {
      throw validationError({ file: ['Send the file as multipart/form-data.'] });
    });
    const meta = fileMetaSchema.safeParse({
      label: form.get('label'),
      kind: form.get('kind'),
      clientVisible: form.get('clientVisible') === 'true',
    });
    if (!meta.success) {
      const fields: Record<string, string[]> = {};
      for (const i of meta.error.issues) (fields[String(i.path[0] ?? 'file')] ??= []).push(i.message);
      throw validationError(fields);
    }
    const file = form.get('file');
    if (!(file instanceof File)) throw validationError({ file: ['Choose a file to upload.'] });
    const res = await svc.addFile(
      c.var.ctx,
      c.req.param('id'),
      { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name },
      meta.data,
    );
    return c.json({ data: res }, 201);
  });
  r.put('/:id/files/:fid', requirePermission('projects.manage'), async (c) => {
    const { clientVisible } = await jsonBody(c, visibility);
    await svc.setFileVisibility(c.var.ctx, c.req.param('id'), c.req.param('fid'), clientVisible);
    return c.json(ok);
  });
  r.delete('/:id/files/:fid', requirePermission('projects.manage'), async (c) => {
    await svc.deleteFile(c.var.ctx, c.req.param('id'), c.req.param('fid'));
    return c.json(ok);
  });
  return r;
}
