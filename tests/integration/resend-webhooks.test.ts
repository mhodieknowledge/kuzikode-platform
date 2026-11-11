/**
 * P6.7 Resend delivery webhooks with signed fixtures (Svix scheme): genuine events update email_logs.status once and never
 * backwards; forged, stale or unsigned requests change nothing; unknown emails and ignored event types are acknowledged.
 */
import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { signResendWebhook } from '../../src/server/modules/email-webhooks';
import { ORIGIN } from '../helpers/api';

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const u = () => Math.random().toString(36).slice(2, 10);
const nowSec = () => Math.floor(Date.now() / 1000);

async function post(
  body: string,
  opts: {
    secret?: string;
    timestamp?: number;
    id?: string;
    signature?: (sig: string) => string;
    headers?: boolean;
  } = {},
) {
  const id = opts.id ?? `msg_${u()}`;
  const ts = String(opts.timestamp ?? nowSec());
  const sig = await signResendWebhook(opts.secret ?? SECRET, id, ts, body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.headers !== false) {
    headers['svix-id'] = id;
    headers['svix-timestamp'] = ts;
    headers['svix-signature'] = opts.signature ? opts.signature(sig) : `v1,${sig}`;
  }
  const res = await exports.default.fetch(`${ORIGIN}/api/webhooks/resend`, { method: 'POST', headers, body });
  return { status: res.status, body: (await res.json()) as any };
}

const event = (type: string, emailId: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: emailId,
      created_at: new Date().toISOString(),
      from: 'Kuzikode <billing@example.com>',
      to: ['client@example.com'],
      subject: 'Invoice INV-2026-00001',
      ...extra,
    },
  });

async function emailLog(status = 'sent') {
  const id = `eml_${u()}`;
  const messageId = `re_${u()}`;
  await env.DB.prepare(
    `INSERT INTO email_logs (id, to_email, template, subject, provider, provider_message_id, status, sent_at)
     VALUES (?, 'client@example.com', 'invoice_issued', 'Invoice INV-2026-00001', 'resend', ?, ?, ?)`,
  )
    .bind(id, messageId, status, new Date().toISOString())
    .run();
  return { id, messageId };
}
const logRow = (id: string) =>
  env.DB.prepare('SELECT status, error FROM email_logs WHERE id = ?')
    .bind(id)
    .first<{ status: string; error: string | null }>();

describe('Resend webhooks (P6.7)', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });

  it('delivered, then a replay and an out-of-order "sent": status moves forward only', async () => {
    const { id, messageId } = await emailLog();
    const body = event('email.delivered', messageId);
    const first = await post(body, { id: 'msg_fixed_1' });
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ event: 'email.delivered', applied: true });
    expect((await logRow(id))!.status).toBe('delivered');
    // Resend retries with the same svix-id: acknowledged, nothing changes.
    expect((await post(body, { id: 'msg_fixed_1' })).body.data.applied).toBe(false);
    expect((await post(event('email.sent', messageId))).body.data.applied).toBe(false);
    expect((await logRow(id))!.status).toBe('delivered');
    // A complaint after delivery is recorded.
    expect((await post(event('email.complained', messageId))).body.data.applied).toBe(true);
    expect(await logRow(id)).toEqual({ status: 'complained', error: 'The recipient marked this email as spam' });
    expect((await post(event('email.delivered', messageId))).body.data.applied).toBe(false);
  });

  it('bounced records the bounce details; failed and suppressed become failed', async () => {
    const a = await emailLog();
    await post(
      event('email.bounced', a.messageId, {
        bounce: { type: 'Permanent', subType: 'Suppressed', message: 'The recipient is on the suppression list.' },
      }),
    );
    expect(await logRow(a.id)).toEqual({
      status: 'bounced',
      error: 'Bounced: Permanent · Suppressed · The recipient is on the suppression list.',
    });
    const b = await emailLog();
    await post(event('email.suppressed', b.messageId));
    expect(await logRow(b.id)).toEqual({
      status: 'failed',
      error: 'Not sent: the address is on the suppression list',
    });
    const c = await emailLog('queued');
    await post(event('email.failed', c.messageId));
    expect((await logRow(c.id))!.status).toBe('failed');
  });

  it('accepts any matching signature among several (secret rotation)', async () => {
    const { id, messageId } = await emailLog();
    const res = await post(event('email.delivered', messageId), {
      signature: (sig) => `v1,${btoa('x'.repeat(32))} v1,${sig}`,
    });
    expect(res.status).toBe(200);
    expect((await logRow(id))!.status).toBe('delivered');
  });

  it('forged, stale, tampered or unsigned requests are refused and change nothing', async () => {
    const { id, messageId } = await emailLog();
    const body = event('email.bounced', messageId);
    const wrongSecret = await post(body, { secret: 'whsec_' + btoa('another-secret-another-secret-12') });
    expect(wrongSecret.status).toBe(401);
    expect(wrongSecret.body.error.code).toBe('UNAUTHENTICATED');
    expect((await post(body, { timestamp: nowSec() - 6 * 60 })).status).toBe(401);
    expect((await post(body, { timestamp: nowSec() + 6 * 60 })).status).toBe(401);
    expect((await post(body, { headers: false })).status).toBe(401);
    expect((await post(body, { signature: (sig) => `v2,${sig}` })).status).toBe(401);
    // Body changed after signing.
    const id2 = `msg_${u()}`;
    const ts = String(nowSec());
    const sig = await signResendWebhook(SECRET, id2, ts, body);
    const tampered = await exports.default.fetch(`${ORIGIN}/api/webhooks/resend`, {
      method: 'POST',
      headers: { 'svix-id': id2, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` },
      body: event('email.bounced', `${messageId}x`),
    });
    expect(tampered.status).toBe(401);
    expect((await logRow(id))!.status).toBe('sent');
  });

  it('unknown emails, other providers and ignored event types are acknowledged without changes', async () => {
    expect((await post(event('email.delivered', 're_unknown'))).body.data).toEqual({
      event: 'email.delivered',
      applied: false,
    });
    const { id, messageId } = await emailLog();
    await env.DB.prepare("UPDATE email_logs SET provider = 'log' WHERE id = ?").bind(id).run();
    expect((await post(event('email.delivered', messageId))).body.data.applied).toBe(false);
    const other = await emailLog();
    for (const t of ['email.opened', 'email.clicked', 'email.delivery_delayed', 'domain.updated'])
      expect((await post(event(t, other.messageId))).status).toBe(200);
    expect((await logRow(other.id))!.status).toBe('sent');
    const invalid = await post('not json');
    expect(invalid.status).toBe(200);
    expect(invalid.body.data).toEqual({ event: 'invalid', applied: false });
  });
});
