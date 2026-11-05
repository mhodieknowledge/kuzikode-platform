import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { handleQueueBatch, MAX_ATTEMPTS, processOutbox } from '../../src/server/jobs/consumer';
import { enqueue } from '../../src/server/jobs/outbox';
import { pruneOperationalData, runScheduled, sweepOutbox, CRON_FREQUENT } from '../../src/server/jobs/scheduled';
import { PermanentJobError, type JobHandlers } from '../../src/server/jobs/types';
import { createStaff } from '../helpers/factories';

let clock = new Date('2026-11-05T10:00:00Z');
const ctx = (e: Env = env) => createContext({ env: e, now: () => clock, actor: { type: 'system', userId: null } });

async function addJob(type: string, key: string) {
  const job = enqueue(ctx(), { type, payload: { n: 1 }, idempotencyKey: key });
  await job.stmt.run();
  return job.id;
}

const status = async (id: string) =>
  (await env.DB.prepare('SELECT status, attempts, last_error FROM outbox WHERE id = ?').bind(id).first<{
    status: string;
    attempts: number;
    last_error: string | null;
  }>())!;

describe('outbox consumer', () => {
  it('runs a job once even when the message is delivered twice', async () => {
    clock = new Date('2026-11-05T10:00:00Z');
    let runs = 0;
    const handlers: JobHandlers = { 'test.count': async () => void runs++ };
    const id = await addJob('test.count', 'dup-1');
    const batch = createMessageBatch('kuzikode-local-jobs', [
      { id: 'a', timestamp: clock, attempts: 1, body: { outboxId: id } },
      { id: 'b', timestamp: clock, attempts: 1, body: { outboxId: id } },
    ]);
    const exec = createExecutionContext();
    await handleQueueBatch(batch, env, exec, handlers);
    expect((await getQueueResult(batch, exec)).explicitAcks.sort()).toEqual(['a', 'b']);
    await processOutbox(ctx(), id, handlers);
    expect(runs).toBe(1);
    expect((await status(id)).status).toBe('done');
  });

  it('retries with backoff, then fails, alerts admins and records an audit row', async () => {
    clock = new Date('2026-11-05T10:00:00Z');
    const admin = await createStaff(['admin']);
    const support = await createStaff(['support_staff']);
    const handlers: JobHandlers = {
      'test.boom': async () => {
        throw new Error('provider timeout');
      },
    };
    const id = await addJob('test.boom', 'boom-1');
    const first = await processOutbox(ctx(), id, handlers);
    expect(first).toEqual({ outcome: 'retry', delaySeconds: 30 });
    expect(await status(id)).toMatchObject({ status: 'pending', attempts: 1, last_error: 'Error: provider timeout' });
    // not available until the backoff has passed
    expect(await processOutbox(ctx(), id, handlers)).toEqual({ outcome: 'skipped' });
    for (let i = 2; i <= MAX_ATTEMPTS; i++) {
      clock = new Date(clock.getTime() + 3 * 3600_000);
      await processOutbox(ctx(), id, handlers);
    }
    expect(await status(id)).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS });
    const notes = await env.DB.prepare(
      "SELECT user_id FROM notifications WHERE type = 'system.job_failed' AND entity_id = ?",
    )
      .bind(id)
      .all<{ user_id: string }>();
    const users = notes.results.map((r) => r.user_id);
    expect(users).toContain(admin.id);
    expect(users).not.toContain(support.id);
    const audit = await env.DB.prepare(
      "SELECT count(*) n FROM audit_logs WHERE action = 'job.failed' AND entity_id = ?",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(audit!.n).toBe(1);
    // a further delivery is a no-op
    clock = new Date(clock.getTime() + 3 * 3600_000);
    expect(await processOutbox(ctx(), id, handlers)).toEqual({ outcome: 'skipped' });
  });

  it('fails immediately on a permanent error or a missing handler', async () => {
    clock = new Date('2026-11-05T10:00:00Z');
    const id = await addJob('test.bad', 'perm-1');
    const r = await processOutbox(ctx(), id, {
      'test.bad': async () => {
        throw new PermanentJobError('template missing');
      },
    });
    expect(r.outcome).toBe('failed');
    const id2 = await addJob('test.unknown', 'perm-2');
    expect((await processOutbox(ctx(), id2, {})).outcome).toBe('failed');
  });

  it('asks the queue to retry on retryable failure and acks malformed messages', async () => {
    clock = new Date('2026-11-05T10:00:00Z');
    const id = await addJob('test.flaky', 'flaky-1');
    const batch = createMessageBatch<unknown>('kuzikode-local-jobs', [
      { id: 'x', timestamp: clock, attempts: 1, body: { outboxId: id } },
      { id: 'y', timestamp: clock, attempts: 1, body: 'garbage' },
    ]);
    const exec = createExecutionContext();
    await handleQueueBatch(batch, env, exec, {
      'test.flaky': async () => {
        throw new Error('try later');
      },
    });
    const res = await getQueueResult(batch, exec);
    expect(res.retryMessages.map((m) => m.msgId)).toEqual(['x']);
    expect(res.explicitAcks).toEqual(['y']);
  });
});

describe('scheduled tasks', () => {
  it('sweeps stale pending and crashed processing jobs back onto the queue', async () => {
    clock = new Date('2026-11-05T10:00:00Z');
    const stale = await addJob('test.sweep', 'sweep-1');
    const crashed = await addJob('test.sweep', 'sweep-2');
    await env.DB.prepare(
      "UPDATE outbox SET status = 'processing', locked_until = '2026-11-05T09:00:00.000Z' WHERE id = ?",
    )
      .bind(crashed)
      .run();
    clock = new Date('2026-11-05T10:05:00Z');
    const fresh = await addJob('test.sweep', 'sweep-3');
    const sent: string[] = [];
    const fakeEnv = {
      ...env,
      JOBS: {
        sendBatch: async (msgs: { body: { outboxId: string } }[]) =>
          void sent.push(...msgs.map((m) => m.body.outboxId)),
      },
    } as unknown as Env;
    await sweepOutbox(ctx(fakeEnv));
    expect(sent).toContain(stale);
    expect(sent).toContain(crashed);
    expect(sent).not.toContain(fresh);
  });

  it('keeps running other tasks when one fails', async () => {
    const outcome = await runScheduled(
      ctx(),
      { cron: CRON_FREQUENT, scheduledTime: 0 },
      {
        [CRON_FREQUENT]: [
          [
            'bad',
            async () => {
              throw new Error('x');
            },
          ],
          ['good', async () => 1],
        ],
      },
    );
    expect(outcome).toEqual({ bad: 'error', good: 'ok' });
  });

  it('prunes old operational data but keeps recent rows', async () => {
    clock = new Date('2026-11-05T10:00:00Z');
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO rate_limits (key, window_start, count) VALUES ('old', '2026-10-01T00:00:00.000Z', 1), ('new', '2026-11-05T09:45:00.000Z', 1)",
      ),
    ]);
    const result = await pruneOperationalData(ctx());
    expect(result.rateLimits).toBeGreaterThanOrEqual(1);
    const keys = await env.DB.prepare("SELECT key FROM rate_limits WHERE key IN ('old','new')").all<{ key: string }>();
    expect(keys.results.map((r) => r.key)).toEqual(['new']);
  });
});
