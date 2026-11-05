import { Hono } from 'hono';
import { newsletterSignupSchema } from '../../../shared/schemas/enquiries';
import { csrfProtect } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import { subscribe } from './service';

export function publicNewsletterRoutes() {
  const r = new Hono<ApiEnv>();
  r.post('/newsletter', csrfProtect(), async (c) => {
    await subscribe(c.var.ctx, await jsonBody(c, newsletterSignupSchema));
    // Same answer whether the address is new, pending or already confirmed (no enumeration).
    return c.json({ data: { status: 'check_inbox' } }, 202);
  });
  return r;
}
