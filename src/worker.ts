import { handle } from '@astrojs/cloudflare/handler';
import { createWorker } from './server/worker-factory';

/**
 * Worker entry (wrangler `main`). `/api/*` is served by Hono; every other path is rendered by Astro.
 * Queue and cron handlers are exported alongside `fetch`.
 */
export default createWorker((request, env, ctx) => handle(request, env, ctx));
