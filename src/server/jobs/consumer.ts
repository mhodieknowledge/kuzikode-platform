import { createContext, type RequestContext } from '../context';
import { stmt } from '../db/client';
import { auditStmt } from '../lib/audit';
import { notifyStaffWithPermission } from '../modules/notifications';
import { defaultHandlers } from './handlers';
import type { QueueMessageBody } from './outbox';
import { PermanentJobError, type JobHandlers } from './types';

export const MAX_ATTEMPTS = 5;
/** Backoff before attempt n+1, in seconds. */
export const BACKOFF_SECONDS = [30, 120, 600, 1800, 7200];
const LOCK_SECONDS = 300;

interface OutboxRow {
  id: string;
  type: string;
  payload: string;
  idempotency_key: string;
  status: string;
  attempts: number;
}

export type ProcessResult =
  | { outcome: 'done' }
  | { outcome: 'skipped' }
  | { outcome: 'retry'; delaySeconds: number }
  | { outcome: 'failed'; error: string };

const errorText = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 1000);

/**
 * Runs one outbox job. The atomic claim (pending, or processing with an expired lock, and available now) means a
 * message delivered twice — by the queue, a retry or the cron sweep — executes the handler at most once at a time,
 * and never again once it is done.
 */
export async function processOutbox(
  ctx: RequestContext,
  outboxId: string,
  handlers: JobHandlers = defaultHandlers,
): Promise<ProcessResult> {
  const now = ctx.now();
  const nowIso = now.toISOString();
  const row = await ctx.db
    .prepare(
      `UPDATE outbox SET status = 'processing', attempts = attempts + 1, locked_until = ?, updated_at = ?
       WHERE id = ? AND available_at <= ?
         AND (status = 'pending' OR (status = 'processing' AND (locked_until IS NULL OR locked_until < ?)))
       RETURNING id, type, payload, idempotency_key, status, attempts`,
    )
    .bind(new Date(now.getTime() + LOCK_SECONDS * 1000).toISOString(), nowIso, outboxId, nowIso, nowIso)
    .first<OutboxRow>();
  if (!row) return { outcome: 'skipped' };

  const log = ctx.logger.child({ outboxId: row.id, jobType: row.type, attempt: row.attempts });
  const handler = handlers[row.type];
  try {
    if (!handler) throw new PermanentJobError(`No handler registered for job type "${row.type}"`);
    await handler(ctx, JSON.parse(row.payload) as unknown, {
      outboxId: row.id,
      idempotencyKey: row.idempotency_key,
      attempt: row.attempts,
    });
    await ctx.db
      .prepare(
        "UPDATE outbox SET status = 'done', processed_at = ?, locked_until = NULL, last_error = NULL, updated_at = ? WHERE id = ?",
      )
      .bind(ctx.now().toISOString(), ctx.now().toISOString(), row.id)
      .run();
    log.info('job done');
    return { outcome: 'done' };
  } catch (err) {
    const error = errorText(err);
    const permanent = err instanceof PermanentJobError;
    if (!permanent && row.attempts < MAX_ATTEMPTS) {
      const delaySeconds = BACKOFF_SECONDS[row.attempts - 1] ?? BACKOFF_SECONDS.at(-1)!;
      await ctx.db
        .prepare(
          "UPDATE outbox SET status = 'pending', available_at = ?, locked_until = NULL, last_error = ?, updated_at = ? WHERE id = ?",
        )
        .bind(new Date(ctx.now().getTime() + delaySeconds * 1000).toISOString(), error, nowIso, row.id)
        .run();
      log.warn('job failed, will retry', { err, delaySeconds });
      return { outcome: 'retry', delaySeconds };
    }
    await ctx.db.batch([
      stmt(
        ctx.db,
        "UPDATE outbox SET status = 'failed', locked_until = NULL, last_error = ?, updated_at = ? WHERE id = ?",
        error,
        nowIso,
        row.id,
      ),
      notifyStaffWithPermission(ctx, 'settings.manage', {
        type: 'system.job_failed',
        title: 'A background job failed',
        body: `${row.type} failed after ${row.attempts} attempt(s): ${error.slice(0, 200)}`,
        link: '/admin/settings/system',
        entityType: 'outbox',
        entityId: row.id,
        dedupeKey: `job_failed:${row.id}`,
      }),
      auditStmt(ctx, {
        action: 'job.failed',
        entityType: 'outbox',
        entityId: row.id,
        after: { type: row.type, attempts: row.attempts, error },
      }),
    ]);
    try {
      await ctx.env.JOBS_DLQ.send({ outboxId: row.id, type: row.type, error });
    } catch (dlqErr) {
      log.error('dead-letter send failed', { err: dlqErr });
    }
    log.error('job failed permanently', { err });
    return { outcome: 'failed', error };
  }
}

export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  env: Env,
  exec: ExecutionContext,
  handlers: JobHandlers = defaultHandlers,
): Promise<void> {
  const ctx = createContext({
    env,
    actor: { type: 'system', userId: null },
    waitUntil: (p) => exec.waitUntil(p),
    route: 'queue',
  });
  for (const message of batch.messages) {
    const body = message.body as Partial<QueueMessageBody> | null;
    if (!body || typeof body.outboxId !== 'string') {
      ctx.logger.warn('dropping malformed queue message', { id: message.id });
      message.ack();
      continue;
    }
    try {
      const result = await processOutbox(ctx, body.outboxId, handlers);
      if (result.outcome === 'retry') message.retry({ delaySeconds: result.delaySeconds });
      else message.ack();
    } catch (err) {
      // Infrastructure error (D1 unavailable): let the queue redeliver; the outbox row is still the source of truth.
      ctx.logger.error('queue message processing error', { err, outboxId: body.outboxId });
      message.retry({ delaySeconds: 60 });
    }
  }
}
