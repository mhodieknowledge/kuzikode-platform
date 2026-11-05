import { Hono } from 'hono';
import { enquirySchema, projectRequestSchema } from '../../../shared/schemas/enquiries';
import { validationError, zodIssuesToFields } from '../../lib/errors';
import { csrfProtect } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import { submitEnquiry, submitProjectRequest } from './enquiries';

/** 10 MB attachment + form fields. */
const MAX_PROJECT_REQUEST_BYTES = 11 * 1024 * 1024;

export function publicEnquiryRoutes() {
  const r = new Hono<ApiEnv>();
  r.post('/enquiries', csrfProtect(), async (c) => {
    const result = await submitEnquiry(c.var.ctx, await jsonBody(c, enquirySchema));
    return c.json({ data: result }, 201);
  });

  // Start-a-Project wizard: multipart with a JSON `data` field and an optional `attachment` file (docs/12 §C.2).
  r.post('/project-requests', csrfProtect(), async (c) => {
    const length = Number(c.req.header('content-length') ?? '0');
    if (length > MAX_PROJECT_REQUEST_BYTES) throw validationError({ attachment: ['Files must be 10 MB or smaller.'] });
    const form = await c.req.formData().catch(() => {
      throw validationError({ data: ['Send the request as multipart/form-data.'] });
    });
    const raw = form.get('data');
    let json: unknown;
    try {
      json = typeof raw === 'string' ? JSON.parse(raw) : undefined;
    } catch {
      json = undefined;
    }
    const parsed = projectRequestSchema.safeParse(json);
    if (!parsed.success) throw validationError(zodIssuesToFields(parsed.error.issues));
    const file = form.get('attachment');
    const attachment =
      file instanceof File && file.size > 0
        ? { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name }
        : undefined;
    const result = await submitProjectRequest(c.var.ctx, parsed.data, attachment);
    return c.json({ data: result }, 201);
  });
  return r;
}
