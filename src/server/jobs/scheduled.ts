import { expireQuotations } from '../modules/quotations';
import { markOverdue, sendReminders } from '../modules/invoices/service';
import { createContext, type RequestContext } from '../context';
import { publishDuePosts } from '../modules/cms/insights';
import { pruneUnconfirmed } from '../modules/newsletter/service';
import { applyApplicationRetention, autoClosePostings } from '../modules/careers/service';
import { sendFollowUpReminders } from '../modules/leads/admin';
import { dispatchNotificationEmails } from '../modules/notifications';
import { billSubscriptions, flagAtRisk, sendRenewalReminders } from '../modules/subscriptions';
import { autoChargeDueInvoices } from '../modules/payments/autocharge';
import type { QueueMessageBody } from './outbox';

export const CRON_FREQUENT = '*/5 * * * *';
export const CRON_NIGHTLY = '17 2 * * *';
/** 07:41 in Harare: client-facing emails (payment reminders) go out in business hours. */
export const CRON_MORNING = '41 5 * * *';

/** A scheduled task: runs inside its own try/catch so one failure never stops the others. */
export type ScheduledTask = (
  ctx: RequestContext,
  controller: { cron: string; scheduledTime: number },
) => Promise<unknown>;

const STALE_PENDING_MS = 2 * 60_000;

/** Re-enqueues outbox rows whose queue message may have been lost (docs/03 §5 step 4). */
export async function sweepOutbox(ctx: RequestContext): Promise<number> {
  const now = ctx.now();
  const { results } = await ctx.db
    .prepare(
      `SELECT id FROM outbox
       WHERE (status = 'pending' AND available_at <= ? AND updated_at <= ?)
          OR (status = 'processing' AND locked_until < ?)
       ORDER BY available_at LIMIT 100`,
    )
    .bind(now.toISOString(), new Date(now.getTime() - STALE_PENDING_MS).toISOString(), now.toISOString())
    .all<{ id: string }>();
  if (results.length === 0) return 0;
  await ctx.env.JOBS.sendBatch(results.map((r) => ({ body: { outboxId: r.id } satisfies QueueMessageBody })));
  // Touch the rows so the next sweep doesn't resend them before the consumer has had a chance.
  await ctx.db
    .prepare(`UPDATE outbox SET updated_at = ? WHERE id IN (SELECT value FROM json_each(?)) AND status = 'pending'`)
    .bind(now.toISOString(), JSON.stringify(results.map((r) => r.id)))
    .run();
  return results.length;
}

/** Retention (PRD §11): rate-limit rows 7 days, sessions 30 days after expiry, idempotency keys after expiry, email logs 1 year. */
export async function pruneOperationalData(ctx: RequestContext): Promise<Record<string, number>> {
  const now = ctx.now().getTime();
  const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();
  const [rl, ses, idem, mail, tok] = await ctx.db.batch([
    ctx.db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(ago(7)),
    ctx.db
      .prepare('DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)')
      .bind(ago(30), ago(30)),
    ctx.db.prepare('DELETE FROM idempotency_keys WHERE expires_at < ?').bind(new Date(now).toISOString()),
    ctx.db
      .prepare('UPDATE email_logs SET html = NULL, text = NULL WHERE created_at < ? AND html IS NOT NULL')
      .bind(ago(30)),
    ctx.db.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').bind(ago(30)),
  ]);
  const yearOld = await ctx.db
    .prepare('DELETE FROM email_logs WHERE created_at < ? AND outbox_id IS NULL')
    .bind(ago(365))
    .run();
  return {
    rateLimits: rl?.meta.changes ?? 0,
    sessions: ses?.meta.changes ?? 0,
    idempotencyKeys: idem?.meta.changes ?? 0,
    emailBodiesCleared: mail?.meta.changes ?? 0,
    authTokens: tok?.meta.changes ?? 0,
    emailLogs: yearOld.meta.changes ?? 0,
  };
}

/** Task lists per cron. Modules append their tasks (overdue sweep, reminders, reconciliation, billing, retention…). */
export const SCHEDULE: Record<string, [name: string, task: ScheduledTask][]> = {
  [CRON_FREQUENT]: [
    ['outbox-sweep', (ctx) => sweepOutbox(ctx)],
    ['notification-emails', (ctx) => dispatchNotificationEmails(ctx)],
    ['publish-due-posts', (ctx) => publishDuePosts(ctx)],
    ['auto-close-postings', (ctx) => autoClosePostings(ctx)],
  ],
  [CRON_NIGHTLY]: [
    ['prune-operational-data', (ctx) => pruneOperationalData(ctx)],
    ['prune-unconfirmed-newsletter', (ctx) => pruneUnconfirmed(ctx)],
    ['application-retention', (ctx) => applyApplicationRetention(ctx)],
    ['lead-follow-up-reminders', (ctx) => sendFollowUpReminders(ctx)],
    ['expire-quotations', (ctx) => expireQuotations(ctx)],
    ['mark-overdue-invoices', (ctx) => markOverdue(ctx)],
    // After overdue marking, so "at risk" sees today's overdue invoices.
    ['subscriptions-at-risk', (ctx) => flagAtRisk(ctx)],
  ],
  [CRON_MORNING]: [
    // Business hours: auto-issued subscription invoices and client renewal emails go out in the morning.
    ['subscription-billing', (ctx) => billSubscriptions(ctx)],
    // After billing: subscription invoices due today are charged to the client's saved card where they consented.
    ['subscription-auto-charge', (ctx) => autoChargeDueInvoices(ctx)],
    ['invoice-reminders', (ctx) => sendReminders(ctx)],
    ['renewal-reminders', (ctx) => sendRenewalReminders(ctx)],
  ],
};

export async function runScheduled(
  ctx: RequestContext,
  controller: { cron: string; scheduledTime: number },
  schedule: Record<string, [string, ScheduledTask][]> = SCHEDULE,
): Promise<Record<string, 'ok' | 'error'>> {
  const outcome: Record<string, 'ok' | 'error'> = {};
  for (const [name, task] of schedule[controller.cron] ?? []) {
    try {
      const result = await task(ctx, controller);
      ctx.logger.info('scheduled task done', { task: name, result });
      outcome[name] = 'ok';
    } catch (err) {
      ctx.logger.error('scheduled task failed', { task: name, err });
      outcome[name] = 'error';
    }
  }
  return outcome;
}

export async function handleScheduled(
  controller: ScheduledController,
  env: Env,
  exec: ExecutionContext,
): Promise<void> {
  const ctx = createContext({
    env,
    actor: { type: 'system', userId: null },
    waitUntil: (p) => exec.waitUntil(p),
    now: () => new Date(),
    route: `cron:${controller.cron}`,
  });
  await runScheduled(ctx, { cron: controller.cron, scheduledTime: controller.scheduledTime });
}
