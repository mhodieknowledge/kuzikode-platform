/** P6.7: our Svix-style signature matches an independent Node crypto computation; tolerance and header parsing. */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signResendWebhook, verifyResendWebhook } from '../../src/server/modules/email-webhooks/service';

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const reference = (id: string, ts: string, body: string) =>
  createHmac('sha256', Buffer.from(SECRET.slice(6), 'base64'))
    .update(`${id}.${ts}.${body}`)
    .digest('base64');
const headers = (h: Record<string, string>) => new Headers(h);

describe('Resend webhook signature', () => {
  const body = '{"type":"email.delivered","data":{"email_id":"re_1"}}';
  const ts = '1794416400';
  const at = new Date(Number(ts) * 1000);

  it('equals the reference HMAC-SHA256 over id.timestamp.body with the base64 key', async () => {
    expect(await signResendWebhook(SECRET, 'msg_1', ts, body)).toBe(reference('msg_1', ts, body));
  });

  it('verifies, with a tolerance of 5 minutes either way', async () => {
    const h = headers({
      'svix-id': 'msg_1',
      'svix-timestamp': ts,
      'svix-signature': `v1,${reference('msg_1', ts, body)}`,
    });
    expect(await verifyResendWebhook(SECRET, h, body, at)).toEqual({ ok: true });
    expect(await verifyResendWebhook(SECRET, h, body, new Date(at.getTime() + 299_000))).toEqual({ ok: true });
    expect(await verifyResendWebhook(SECRET, h, body, new Date(at.getTime() + 301_000))).toEqual({
      ok: false,
      reason: 'stale_timestamp',
    });
    expect(await verifyResendWebhook(SECRET, h, `${body} `, at)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects missing or malformed headers and a malformed secret', async () => {
    expect(await verifyResendWebhook(SECRET, headers({}), body, at)).toEqual({ ok: false, reason: 'missing_headers' });
    const h = headers({ 'svix-id': 'msg_1', 'svix-timestamp': 'soon', 'svix-signature': 'v1,abc' });
    expect(await verifyResendWebhook(SECRET, h, body, at)).toEqual({ ok: false, reason: 'missing_headers' });
    const ok = headers({
      'svix-id': 'msg_1',
      'svix-timestamp': ts,
      'svix-signature': `v1,${reference('msg_1', ts, body)}`,
    });
    expect(await verifyResendWebhook('whsec_%%%', ok, body, at)).toEqual({ ok: false, reason: 'bad_signature' });
  });
});
