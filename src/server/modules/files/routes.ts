import { Hono } from 'hono';
import { z } from 'zod';
import { notFound, validationError } from '../../lib/errors';
import { assertCan } from '../../lib/policies';
import { csrfProtect, requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';

import {
  authorizeRead,
  downloadAudit,
  fileResponse,
  FINANCIAL_OWNERS,
  getFile,
  storeUpload,
  STAFF_READ_PERMISSION,
  verifySignedFile,
  type OwnerType,
} from './service';
import { PURPOSES, type UploadPurpose } from '../../lib/uploads';

const MAX_MULTIPART_BYTES = 11 * 1024 * 1024;

const uploadMeta = z
  .object({
    purpose: z.enum(Object.keys(PURPOSES) as [UploadPurpose, ...UploadPurpose[]]),
    ownerType: z.enum(Object.keys(STAFF_READ_PERMISSION) as [OwnerType, ...OwnerType[]]),
    ownerId: z.string().max(64).optional(),
  })
  .strict();

export function fileRoutes() {
  const r = new Hono<ApiEnv>();

  // Staff download (permission by owner type; financial documents audited).
  r.get('/admin/files/:id', withAuth('admin'), requireAuth('admin'), async (c) => {
    const ctx = c.var.ctx;
    const f = await authorizeRead(ctx, c.req.param('id'));
    if (FINANCIAL_OWNERS.includes(f.owner_type)) await downloadAudit(ctx, f).run();
    return fileResponse(ctx, f);
  });

  // Portal download (owning entity must be in the caller's client scope and client-visible).
  r.get('/portal/files/:id', withAuth('portal'), requireAuth('portal'), async (c) => {
    const f = await authorizeRead(c.var.ctx, c.req.param('id'));
    return fileResponse(c.var.ctx, f);
  });

  // Short-lived signed link (no session; used by public document pages and emails).
  r.get('/files/signed/:id', async (c) => {
    const ctx = c.var.ctx;
    const id = c.req.param('id');
    if (!(await verifySignedFile(ctx, id, c.req.query('exp'), c.req.query('sig')))) throw notFound();
    const f = await getFile(ctx, id);
    if (!f) throw notFound();
    return fileResponse(ctx, f);
  });

  // Generic staff upload. Modules with their own records (projects, expenses…) call storeUpload() in their own routes.
  r.post('/admin/files', withAuth('admin'), requireAuth('admin'), csrfProtect(), async (c) => {
    const ctx = c.var.ctx;
    if (Number(c.req.header('content-length') ?? '0') > MAX_MULTIPART_BYTES)
      throw validationError({ file: ['Files must be 10 MB or smaller.'] });
    const form = await c.req.formData().catch(() => {
      throw validationError({ file: ['Send the file as multipart/form-data.'] });
    });
    const meta = uploadMeta.safeParse({
      purpose: form.get('purpose'),
      ownerType: form.get('ownerType'),
      ...(form.get('ownerId') ? { ownerId: form.get('ownerId') } : {}),
    });
    if (!meta.success) throw validationError({ purpose: ['Invalid upload target.'] });
    const ownerPerm = meta.data.ownerType === 'media' ? 'media.manage' : STAFF_READ_PERMISSION[meta.data.ownerType];
    assertCan(ctx, ownerPerm);
    const file = form.get('file');
    if (!(file instanceof File)) throw validationError({ file: ['Choose a file to upload.'] });
    const stored = await storeUpload(ctx, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      purpose: meta.data.purpose,
      ownerType: meta.data.ownerType,
      ownerId: meta.data.ownerId ?? null,
    });
    await stored.stmt.run();
    return c.json(
      {
        data: {
          id: stored.id,
          name: stored.name,
          mime: stored.mime,
          size: stored.size,
          width: stored.width,
          height: stored.height,
        },
      },
      201,
    );
  });

  return r;
}
