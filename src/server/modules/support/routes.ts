import { Hono } from 'hono';
import {
  newSupportSchema,
  supportListQuery,
  supportReplySchema,
  supportUpdateSchema,
} from '../../../shared/schemas/support';
import { validationError } from '../../lib/errors';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as svc from './service';

const MAX_MULTIPART_BYTES = 26 * 1024 * 1024;

/** `/api/v1/admin/support`. */
export function supportRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('support.view'), async (c) =>
    c.json({ data: await svc.listRequests(c.var.ctx, query(c, supportListQuery)) }),
  );
  r.post('/', requirePermission('support.reply'), async (c) =>
    c.json({ data: await svc.createRequest(c.var.ctx, await jsonBody(c, newSupportSchema)) }, 201),
  );
  r.get('/:id', requirePermission('support.view'), async (c) =>
    c.json({ data: await svc.getRequest(c.var.ctx, c.req.param('id')) }),
  );
  r.patch('/:id', requirePermission('support.manage'), async (c) => {
    await svc.updateRequest(c.var.ctx, c.req.param('id'), await jsonBody(c, supportUpdateSchema));
    return c.json({ data: { ok: true } });
  });
  // Replies come as JSON, or as multipart (fields body/internal/status + up to 5 `files`).
  r.post('/:id/messages', requirePermission('support.reply'), async (c) => {
    const ctx = c.var.ctx;
    if (!(c.req.header('content-type') ?? '').startsWith('multipart/form-data'))
      return c.json({ data: await svc.reply(ctx, c.req.param('id'), await jsonBody(c, supportReplySchema)) }, 201);
    if (Number(c.req.header('content-length') ?? '0') > MAX_MULTIPART_BYTES)
      throw validationError({ files: ['Attachments are too large.'] });
    const form = await c.req.formData().catch(() => {
      throw validationError({ files: ['Send the reply as multipart/form-data.'] });
    });
    const parsed = supportReplySchema.safeParse({
      body: form.get('body'),
      internal: form.get('internal') === 'true',
      ...(form.get('status') ? { status: form.get('status') } : {}),
    });
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const i of parsed.error.issues) (fields[String(i.path[0] ?? 'body')] ??= []).push(i.message);
      throw validationError(fields);
    }
    const files = [];
    for (const f of form.getAll('files'))
      if (f instanceof File && f.size > 0)
        files.push({ bytes: new Uint8Array(await f.arrayBuffer()), filename: f.name });
    return c.json({ data: await svc.reply(ctx, c.req.param('id'), parsed.data, files) }, 201);
  });
  return r;
}
