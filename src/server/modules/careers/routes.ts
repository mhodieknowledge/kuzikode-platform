import { Hono, type Context } from 'hono';
import { applicationSchema } from '../../../shared/schemas/careers';
import { validationError, zodIssuesToFields } from '../../lib/errors';
import { csrfProtect } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { submitApplication } from './service';

/** CV (5 MB) + cover letter file (5 MB) + fields. */
const MAX_APPLICATION_BYTES = 11 * 1024 * 1024;

async function handleApplication(c: Context<ApiEnv>, slug: string | null) {
  if (Number(c.req.header('content-length') ?? '0') > MAX_APPLICATION_BYTES) {
    throw validationError({ cv: ['Files must be 5 MB or smaller.'] });
  }
  const form = await c.req.formData().catch(() => {
    throw validationError({ data: ['Send the application as multipart/form-data.'] });
  });
  let json: unknown;
  try {
    const raw = form.get('data');
    json = typeof raw === 'string' ? JSON.parse(raw) : undefined;
  } catch {
    json = undefined;
  }
  const parsed = applicationSchema.safeParse(json);
  if (!parsed.success) throw validationError(zodIssuesToFields(parsed.error.issues));
  const file = async (name: string) => {
    const f = form.get(name);
    return f instanceof File && f.size > 0
      ? { bytes: new Uint8Array(await f.arrayBuffer()), filename: f.name }
      : undefined;
  };
  const result = await submitApplication(c.var.ctx, slug, parsed.data, {
    cv: await file('cv'),
    coverLetter: await file('coverLetterFile'),
  });
  return c.json({ data: result }, 201);
}

/** Public application endpoints (docs/12 §B.1): multipart with a JSON `data` field, `cv` and optional `coverLetterFile`. */
export function publicCareersRoutes() {
  const r = new Hono<ApiEnv>();
  r.post('/careers/:slug/applications', csrfProtect(), (c) => handleApplication(c, c.req.param('slug')));
  r.post('/careers/applications', csrfProtect(), (c) => handleApplication(c, null));
  return r;
}
