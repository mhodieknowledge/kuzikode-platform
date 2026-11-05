import { z } from 'zod';
import type { RequestContext } from '../../context';
import { brandFor, emailProvider, EmailProviderError } from '../../email';
import { isTemplate, renderTemplate } from '../../email/templates';
import { newId } from '../../lib/ids';
import { PermanentJobError, type JobHandler } from '../types';

export const sendEmailPayload = z.object({
  template: z.string(),
  to: z.email(),
  data: z.record(z.string(), z.unknown()).default({}),
  replyTo: z.email().optional(),
});
export type SendEmailPayload = z.infer<typeof sendEmailPayload>;

/**
 * `email.send`: renders the template, records it in email_logs (one row per outbox job), and sends via the provider
 * with the outbox idempotency key, so a retried job never sends twice.
 */
export const sendEmailHandler: JobHandler = async (ctx: RequestContext, payload, meta) => {
  const parsed = sendEmailPayload.safeParse(payload);
  if (!parsed.success)
    throw new PermanentJobError(`invalid email payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  const p = parsed.data;
  if (!isTemplate(p.template)) throw new PermanentJobError(`unknown email template "${p.template}"`);

  const existing = await ctx.db
    .prepare('SELECT id, status FROM email_logs WHERE outbox_id = ?')
    .bind(meta.outboxId)
    .first<{ id: string; status: string }>();
  if (existing && existing.status !== 'queued' && existing.status !== 'failed') return;

  let rendered;
  try {
    rendered = renderTemplate(p.template, await brandFor(ctx), p.data);
  } catch (err) {
    throw new PermanentJobError(
      `template data invalid for ${p.template}: ${err instanceof Error ? err.message.slice(0, 200) : ''}`,
    );
  }
  const provider = emailProvider(ctx);
  const now = ctx.now().toISOString();
  const logId = existing?.id ?? newId('eml', ctx.now().getTime());
  if (!existing) {
    await ctx.db
      .prepare(
        `INSERT OR IGNORE INTO email_logs (id, outbox_id, to_email, template, subject, provider, status, html, text, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`,
      )
      .bind(
        logId,
        meta.outboxId,
        p.to,
        p.template,
        rendered.subject,
        provider.name,
        rendered.html,
        rendered.text,
        now,
        now,
      )
      .run();
  }
  try {
    const result = await provider.send(
      {
        to: p.to,
        from: ctx.config.emailFrom,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(p.replyTo || ctx.config.emailReplyTo ? { replyTo: p.replyTo ?? ctx.config.emailReplyTo } : {}),
        tags: { template: p.template },
      },
      { idempotencyKey: meta.idempotencyKey },
    );
    await ctx.db
      .prepare(
        "UPDATE email_logs SET status = 'sent', provider_message_id = ?, sent_at = ?, error = NULL, updated_at = ? WHERE outbox_id = ?",
      )
      .bind(result.providerMessageId, ctx.now().toISOString(), ctx.now().toISOString(), meta.outboxId)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : 'send failed';
    await ctx.db
      .prepare("UPDATE email_logs SET status = 'failed', error = ?, updated_at = ? WHERE outbox_id = ?")
      .bind(message, ctx.now().toISOString(), meta.outboxId)
      .run();
    if (err instanceof EmailProviderError && !err.retryable) throw new PermanentJobError(message);
    throw err;
  }
};
