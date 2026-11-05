/**
 * Newsletter with double opt-in (docs/12 §C.10). Sign-up never reveals whether an address is already subscribed.
 * Confirm and unsubscribe are explicit POST actions (link scanners only GET), and the unsubscribe link is an HMAC
 * of the subscriber id, so it needs no stored token and works for every future email.
 */
import type { RequestContext } from '../../context';
import { stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { hashIp, hmacSha256Base64Url, sha256Hex, timingSafeEqualString } from '../../lib/crypto';
import { newId, randomToken } from '../../lib/ids';
import { enforce } from '../../lib/rate-limit';
import { dispatch, enqueue } from '../../jobs/outbox';

export const CONFIRM_TTL_MS = 7 * 24 * 3600_000;
export const RESEND_AFTER_MS = 10 * 60_000;

interface SubscriberRow {
  id: string;
  email: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  updated_at: string;
}

/** Sign-up: always resolves the same way for the caller. Sends a confirmation email when appropriate. */
export async function subscribe(
  ctx: RequestContext,
  input: { email: string; source?: string | undefined; website?: string | undefined },
): Promise<void> {
  if (input.website && input.website.trim() !== '') return; // honeypot
  await enforce(ctx, { key: `newsletter:ip:${ctx.ip}`, limit: 5, windowSeconds: 3600 });
  const email = input.email.trim().toLowerCase();
  const now = ctx.now();
  const existing = await ctx.db
    .prepare('SELECT id, email, status, updated_at FROM newsletter_subscribers WHERE email = ?')
    .bind(email)
    .first<SubscriberRow>();
  if (existing?.status === 'confirmed') return;
  if (existing?.status === 'pending' && now.getTime() - Date.parse(existing.updated_at) < RESEND_AFTER_MS) return;

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const id = existing?.id ?? newId('nws', now.getTime());
  const link = new URL(`/newsletter/confirm?token=${encodeURIComponent(token)}`, ctx.config.siteUrl).toString();
  const job = enqueue(ctx, {
    type: 'email.send',
    payload: { template: 'newsletter_confirmation', to: email, data: { link } },
    idempotencyKey: `email:newsletter_confirm:${tokenHash.slice(0, 32)}`,
  });
  const ipHash = await hashIp(ctx.ip, ctx.config.hmacSecret);
  const write = existing
    ? stmt(
        ctx.db,
        `UPDATE newsletter_subscribers SET status = 'pending', confirm_token_hash = ?, unsubscribed_at = NULL, ip_hash = ?, updated_at = ?
         WHERE id = ?`,
        tokenHash,
        ipHash,
        now.toISOString(),
        id,
      )
    : stmt(
        ctx.db,
        `INSERT INTO newsletter_subscribers (id, email, status, confirm_token_hash, source, ip_hash, created_at, updated_at)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
        id,
        email,
        tokenHash,
        input.source ?? null,
        ipHash,
        now.toISOString(),
        now.toISOString(),
      );
  await ctx.db.batch([write, job.stmt]);
  dispatch(ctx, [job.id]);
}

export type ConfirmOutcome = 'confirmed' | 'invalid' | 'expired';

export async function confirmSubscription(ctx: RequestContext, token: string): Promise<ConfirmOutcome> {
  if (!token || token.length > 200) return 'invalid';
  const row = await ctx.db
    .prepare(
      "SELECT id, email, status, updated_at FROM newsletter_subscribers WHERE confirm_token_hash = ? AND status = 'pending'",
    )
    .bind(await sha256Hex(token))
    .first<SubscriberRow>();
  if (!row) return 'invalid';
  const now = ctx.now();
  if (now.getTime() - Date.parse(row.updated_at) > CONFIRM_TTL_MS) return 'expired';
  await ctx.db.batch([
    stmt(
      ctx.db,
      `UPDATE newsletter_subscribers SET status = 'confirmed', confirmed_at = ?, confirm_token_hash = NULL, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
      now.toISOString(),
      now.toISOString(),
      row.id,
    ),
    auditStmt(ctx, { action: 'newsletter.confirmed', entityType: 'newsletter_subscriber', entityId: row.id }),
  ]);
  return 'confirmed';
}

const unsubscribeMessage = (id: string) => `newsletter:unsubscribe:${id}`;

/** Permanent unsubscribe URL for a subscriber (included in exports for the mailing tool). */
export async function unsubscribeUrl(ctx: RequestContext, subscriberId: string): Promise<string> {
  const sig = await hmacSha256Base64Url(ctx.config.hmacSecret, unsubscribeMessage(subscriberId));
  const url = new URL('/newsletter/unsubscribe', ctx.config.siteUrl);
  url.searchParams.set('id', subscriberId);
  url.searchParams.set('sig', sig);
  return url.toString();
}

export async function verifyUnsubscribe(ctx: RequestContext, id: string, sig: string): Promise<boolean> {
  if (!/^nws_[A-Za-z0-9]+$/.test(id) || !sig || sig.length > 100) return false;
  const expected = await hmacSha256Base64Url(ctx.config.hmacSecret, unsubscribeMessage(id));
  return timingSafeEqualString(expected, sig);
}

export async function unsubscribe(ctx: RequestContext, id: string, sig: string): Promise<boolean> {
  if (!(await verifyUnsubscribe(ctx, id, sig))) return false;
  const now = ctx.now().toISOString();
  await ctx.db.batch([
    stmt(
      ctx.db,
      `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = ?, confirm_token_hash = NULL, updated_at = ?
       WHERE id = ? AND status <> 'unsubscribed'`,
      now,
      now,
      id,
    ),
    auditStmt(ctx, { action: 'newsletter.unsubscribed', entityType: 'newsletter_subscriber', entityId: id }),
  ]);
  return true;
}

/** Nightly: unconfirmed sign-ups older than 30 days are deleted (PRD §11 data minimisation). */
export async function pruneUnconfirmed(ctx: RequestContext): Promise<number> {
  const cutoff = new Date(ctx.now().getTime() - 30 * 86_400_000).toISOString();
  const res = await ctx.db
    .prepare("DELETE FROM newsletter_subscribers WHERE status = 'pending' AND updated_at < ?")
    .bind(cutoff)
    .run();
  return res.meta.changes ?? 0;
}
