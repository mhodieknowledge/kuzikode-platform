import { createWorker } from '../../src/server/worker-factory';

/** Test entry: same API/queue/cron handlers as production, with a stub in place of the Astro page renderer. */
export default createWorker((request) => {
  const url = new URL(request.url);
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  if (url.pathname === '/with-cookie') headers.set('set-cookie', 'a=b');
  if (url.pathname === '/missing') return new Response('<!doctype html><title>404</title>', { status: 404, headers });
  return new Response(`<!doctype html><title>stub page</title><p>${url.pathname} ${Date.now()}-${Math.random()}</p>`, {
    headers,
  });
});
