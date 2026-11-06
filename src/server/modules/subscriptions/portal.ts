/**
 * Portal "Your services" (P5.7, docs/12 §A.3–A.4): the client's running subscriptions (amount, interval, next bill)
 * and the domains, hosting and other assets Kuzikode manages for them. Prices are billing information, so the page
 * follows the finance area (owner and billing contacts). "Request cancellation" never cancels anything itself: it
 * opens a billing support request that staff act on (one open request per subscription).
 */
import type { RequestContext } from '../../context';
import { clientScope, portalAreaClientIds } from '../../lib/policies';
import { notFound } from '../../lib/errors';
import { ASSET_TYPE_LABELS } from './assets';
import { clientServices } from './service';
import { createPortalRequest } from '../support/portal';

export async function listPortalServices(ctx: RequestContext) {
  const ids = portalAreaClientIds(ctx, 'finance');
  const s = clientScope('id', ids);
  const { results: clients } = await ctx.db
    .prepare(`SELECT id, display_name AS name FROM clients WHERE ${s.sql} ORDER BY display_name`)
    .bind(...s.params)
    .all<{ id: string; name: string }>();
  const out = [];
  for (const c of clients) {
    const svc = await clientServices(ctx, c.id);
    // Show whether a cancellation request is already waiting, so the button is not offered twice.
    const pending = await openCancellationSubjects(ctx, c.id);
    out.push({
      client: c,
      subscriptions: svc.subscriptions.map((x) => ({
        ...x,
        cancellationRequested: pending.has(cancellationSubject(x.description)),
      })),
      assets: svc.assets.map((a) => ({ ...a, typeLabel: ASSET_TYPE_LABELS[a.type] ?? 'Service' })),
    });
  }
  return out;
}

const cancellationSubject = (description: string) => `Cancellation request: ${description}`.slice(0, 200);

async function openCancellationSubjects(ctx: RequestContext, clientId: string): Promise<Set<string>> {
  const { results } = await ctx.db
    .prepare(
      `SELECT subject FROM support_requests WHERE client_id = ? AND category = 'billing'
       AND status IN ('open','awaiting_client') AND subject LIKE 'Cancellation request: %'`,
    )
    .bind(clientId)
    .all<{ subject: string }>();
  return new Set(results.map((r) => r.subject));
}

/** Opens (or returns the already-open) billing support request asking staff to cancel a subscription. */
export async function requestCancellation(
  ctx: RequestContext,
  subscriptionId: string,
  reason: string | undefined,
): Promise<{ id: string; reference: string; existing: boolean }> {
  const s = clientScope('client_id', portalAreaClientIds(ctx, 'finance'));
  const sub = await ctx.db
    .prepare(
      `SELECT id, client_id, description, interval, next_billing_date, status FROM subscriptions
       WHERE id = ? AND status IN ('active','at_risk','paused') AND ${s.sql}`,
    )
    .bind(subscriptionId, ...s.params)
    .first<{
      id: string;
      client_id: string;
      description: string;
      interval: string;
      next_billing_date: string;
      status: string;
    }>();
  if (!sub) throw notFound();
  const subject = cancellationSubject(sub.description);
  const existing = await ctx.db
    .prepare(
      `SELECT id, reference FROM support_requests WHERE client_id = ? AND category = 'billing' AND subject = ?
       AND status IN ('open','awaiting_client') ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(sub.client_id, subject)
    .first<{ id: string; reference: string }>();
  if (existing) return { ...existing, existing: true };
  const body = [
    `Please cancel this subscription: ${sub.description} (billed every ${sub.interval}).`,
    sub.status === 'paused' ? 'It is currently paused.' : `The next bill is due on ${sub.next_billing_date}.`,
    reason ? `Reason: ${reason}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
  const created = await createPortalRequest(ctx, { clientId: sub.client_id, subject, category: 'billing', body }, [], {
    auditAction: 'subscription.cancellation_requested',
    auditAfter: { subscriptionId: sub.id },
  });
  return { ...created, existing: false };
}
