import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('worker entry', () => {
  it('routes /api/health to the API', async () => {
    const res = await exports.default.fetch('http://localhost/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: 'ok' } });
  });

  it('routes other paths to the page handler', async () => {
    const res = await exports.default.fetch('http://localhost/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('stub page');
  });
});

describe('worker background handlers', () => {
  it('exposes a queue handler that acks delivered messages', async () => {
    const { createMessageBatch, createExecutionContext, getQueueResult } = await import('cloudflare:test');
    const { env } = await import('cloudflare:workers');
    const worker = (await import('../helpers/test-worker')).default;
    const batch = createMessageBatch('kuzikode-local-jobs', [
      { id: 'm1', timestamp: new Date(1000), attempts: 1, body: { outboxId: 'obx_unknown' } },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toEqual(['m1']);
  });

  it('exposes a scheduled handler', async () => {
    const { createScheduledController, createExecutionContext, waitOnExecutionContext } =
      await import('cloudflare:test');
    const { env } = await import('cloudflare:workers');
    const worker = (await import('../helpers/test-worker')).default;
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: '*/5 * * * *', scheduledTime: 0 }), env, ctx);
    await waitOnExecutionContext(ctx);
  });
});
