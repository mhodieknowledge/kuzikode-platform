import { createWorker } from '../../src/server/worker-factory';

/** Test entry: same API/queue/cron handlers as production, with a stub in place of the Astro page renderer. */
export default createWorker(
  () => new Response('<!doctype html><title>stub page</title>', { headers: { 'content-type': 'text/html' } }),
);
