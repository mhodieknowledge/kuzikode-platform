import { Hono } from 'hono';

export type AppBindings = { Bindings: Env };

export function createApp() {
  const app = new Hono<AppBindings>();
  app.get('/api/health', (c) => c.json({ data: { status: 'ok' } }));
  return app;
}
