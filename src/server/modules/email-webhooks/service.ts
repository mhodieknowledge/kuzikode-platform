/**
 * Resend delivery webhooks (PRD §7, P6.7): `POST /api/webhooks/resend` → `email_logs.status`.
 *
 * Resend signs webhooks the Svix way (verified against resend.com/docs/dashboard/webhooks/verify-webhooks-requests and
 * docs.svix.com/receiving/verifying-payloads/how-manual, 2026-11-11): headers `svix-id`, `svix-timestamp`,
 * `svix-signature`; signed content `${id}.${timestamp}.${rawBody}`; HMAC-SHA256 keyed with the base64-decoded part of the
 * `whsec_…` secret; the header holds space-separated `v1,<base64>` signatures (any one may match). We reject timestamps
 * more than 5 minutes from our clock (replays). Retries reuse `svix-id`; status updates are monotonic, so a replayed or
 * out-of-order event never moves an email backwards.
 */
import type { RequestContext } from '../../context';
import { base64ToBytes, bytesToBase64, timingSafeEqualString } from '../../lib/crypto';

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export type EmailStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed';

/** Later states win; equal or lower ranks never overwrite (complaints can follow delivery, never the reverse). */
const RANK: Record<EmailStatus, number> = { queued: 0, sent: 1, delivered: 2, bounced: 3, failed: 3, complained: 4 };

/** Resend event → our status. Events not listed (opened, clicked, received, scheduled, domain.*, …) are acknowledged and ignored. */
const EVENT_STATUS: Record<string, EmailStatus> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'failed',
};

function secretKey(secret: string): Uint8Array<ArrayBuffer> {
  return base64ToBytes(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret);
}

/** Computes the `v1` signature for a webhook (also used by tests to sign fixtures). */
export async function signResendWebhook(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secretKey(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToBase64(new Uint8Array(mac));
}

export type VerifyResult =
  { ok: true } | { ok: false; reason: 'missing_headers' | 'stale_timestamp' | 'bad_signature' };

export async function verifyResendWebhook(
  secret: string,
  headers: Headers,
  body: string,
  now: Date,
): Promise<VerifyResult> {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatures = headers.get('svix-signature');
  if (!id || !timestamp || !signatures || !/^\d{1,12}$/.test(timestamp))
    return { ok: false, reason: 'missing_headers' };
  if (Math.abs(now.getTime() / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS)
    return { ok: false, reason: 'stale_timestamp' };
  let expected: string;
  try {
    expected = await signResendWebhook(secret, id, timestamp, body);
  } catch {
    return { ok: false, reason: 'bad_signature' }; // a malformed secret never verifies anything
  }
  let match = false;
  for (const part of signatures.split(' ')) {
    const [version, sig] = part.split(',', 2);
    // Compare every candidate (no early exit) in constant time.
    if (version === 'v1' && sig && timingSafeEqualString(sig, expected)) match = true;
  }
  return match ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

interface ResendEvent {
  type?: unknown;
  data?: { email_id?: unknown; bounce?: { message?: unknown; type?: unknown; subType?: unknown }; failed?: unknown };
}

export interface WebhookOutcome {
  event: string;
  applied: boolean;
}

function detailFor(status: EmailStatus, e: ResendEvent): string | null {
  if (status === 'bounced') {
    const b = e.data?.bounce;
    const parts = [b?.type, b?.subType, b?.message].filter((x): x is string => typeof x === 'string' && x.length > 0);
    return parts.length ? `Bounced: ${parts.join(' · ')}`.slice(0, 500) : 'Bounced';
  }
  if (status === 'complained') return 'The recipient marked this email as spam';
  if (status === 'failed')
    return e.type === 'email.suppressed'
      ? 'Not sent: the address is on the suppression list'
      : 'Resend could not send this email';
  return null;
}

/**
 * Applies a verified Resend event to the email log it belongs to (matched by Resend's email id). Unknown emails and
 * ignored event types are acknowledged so Resend stops retrying.
 */
export async function applyResendEvent(ctx: RequestContext, body: string): Promise<WebhookOutcome> {
  let e: ResendEvent;
  try {
    e = JSON.parse(body) as ResendEvent;
  } catch {
    return { event: 'invalid', applied: false };
  }
  const type = typeof e.type === 'string' ? e.type.slice(0, 60) : 'unknown';
  const status = EVENT_STATUS[type];
  const emailId = typeof e.data?.email_id === 'string' ? e.data.email_id.slice(0, 100) : null;
  if (!status || !emailId) return { event: type, applied: false };
  const rank = RANK[status];
  const lower = (Object.keys(RANK) as EmailStatus[]).filter((s) => RANK[s] < rank);
  const res = await ctx.db
    .prepare(
      `UPDATE email_logs SET status = ?, error = COALESCE(?, error), updated_at = ?
       WHERE provider = 'resend' AND provider_message_id = ? AND status IN (SELECT value FROM json_each(?))`,
    )
    .bind(status, detailFor(status, e), ctx.now().toISOString(), emailId, JSON.stringify(lower))
    .run();
  const applied = (res.meta.changes ?? 0) > 0;
  ctx.logger.info('resend webhook', { event: type, applied });
  return { event: type, applied };
}
