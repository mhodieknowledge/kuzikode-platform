import { Hono } from 'hono';
import { enquirySchema } from '../../../shared/schemas/enquiries';
import { csrfProtect } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import { submitEnquiry } from './enquiries';

export function publicEnquiryRoutes() {
  const r = new Hono<ApiEnv>();
  r.post('/enquiries', csrfProtect(), async (c) => {
    const result = await submitEnquiry(c.var.ctx, await jsonBody(c, enquirySchema));
    return c.json({ data: result }, 201);
  });
  return r;
}
