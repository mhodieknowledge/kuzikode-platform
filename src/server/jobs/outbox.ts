import type { RequestContext } from '../context';
import { stmt } from '../db/client';
import { newId } from '../lib/ids';

export interface OutboxJob<T = unknown> {
  type: string;
  payload: T;
  /** Unique per logical job: a retried request or duplicate event never creates a second job. */
  idempotencyKey: string;
  /** Delay the job until this time (ISO). Defaults to now. */
  availableAt?: string;
}

export interface Enqueued {
  id: string;
  stmt: D1PreparedStatement;
}

export interface QueueMessageBody {
  outboxId: string;
}

/**
 * Builds the outbox INSERT for the caller's batch (docs/03 §5). Duplicate idempotency keys are ignored, so the
 * business change and its jobs commit together exactly once. After the batch commits, call `dispatch()`.
 */
export function enqueue<T>(ctx: RequestContext, job: OutboxJob<T>): Enqueued {
  const id = newId('obx', ctx.now().getTime());
  const now = ctx.now().toISOString();
  return {
    id,
    stmt: stmt(
      ctx.db,
      `INSERT OR IGNORE INTO outbox (id, type, payload, idempotency_key, status, attempts, available_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
      id,
      job.type,
      JSON.stringify(job.payload),
      job.idempotencyKey,
      job.availableAt ?? now,
      now,
      now,
    ),
  };
}

/** Sends committed outbox rows to the queue in the background. Lost sends are recovered by the cron sweep. */
export function dispatch(ctx: RequestContext, ids: string[]): void {
  if (ids.length === 0) return;
  const send = async () => {
    try {
      await ctx.env.JOBS.sendBatch(ids.map((outboxId) => ({ body: { outboxId } satisfies QueueMessageBody })));
    } catch (err) {
      ctx.logger.warn('queue send failed; outbox sweep will retry', { err, count: ids.length });
    }
  };
  ctx.waitUntil(send());
}
