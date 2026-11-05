import { createApp } from './app';
import { createContext } from './context';
import { withPageCache } from './lib/page-cache';
import { handleQueueBatch } from './jobs/consumer';
import { handleScheduled } from './jobs/scheduled';

export type PageHandler = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

export const API_PREFIX = '/api/';

/** Builds the Worker's exported handlers. The page handler is injected so tests can run without an Astro build. */
export function createWorker(pageHandler: PageHandler) {
  const app = createApp();
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const { pathname } = new URL(request.url);
      if (pathname === '/api' || pathname.startsWith(API_PREFIX)) {
        return app.fetch(request, env, ctx);
      }
      const pageCtx = createContext({ env, request, waitUntil: (p) => ctx.waitUntil(p) });
      return withPageCache(pageCtx, request, async () => pageHandler(request, env, ctx));
    },
    async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
      await handleQueueBatch(batch, env, ctx);
    },
    async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
      await handleScheduled(controller, env, ctx);
    },
  } satisfies ExportedHandler<Env>;
}
