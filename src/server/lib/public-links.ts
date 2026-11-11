/**
 * Public document links (`/q/<token>`, `/i/<token>`…). The token is derived — HMAC of the kind and id — so the same
 * link can be shown again or re-sent without storing it; only its SHA-256 is stored, for lookup.
 */
import type { RequestContext } from '../context';
import { hmacSha256Base64Url, sha256Hex, timingSafeEqualString } from './crypto';

export type LinkKind = 'quotation' | 'invoice' | 'credit_note' | 'receipt';

const PATH: Record<LinkKind, string> = { quotation: 'q', invoice: 'i', credit_note: 'cn', receipt: 'r' };

export async function documentToken(ctx: RequestContext, kind: LinkKind, id: string) {
  const token = await hmacSha256Base64Url(ctx.config.hmacSecret, `${kind}:${id}`);
  return { token, hash: await sha256Hex(token) };
}

export async function documentLink(ctx: RequestContext, kind: LinkKind, id: string): Promise<string> {
  return `${ctx.config.siteOrigin}/${PATH[kind]}/${(await documentToken(ctx, kind, id)).token}`;
}

export const looksLikeToken = (token: string) => /^[A-Za-z0-9_-]{20,100}$/.test(token);

/**
 * Browser return from a payment gateway (`/pay/return?attempt=<id>&t=<sig>`, docs/06 §3). The signature is an HMAC of the
 * attempt id, so only the link we gave the gateway opens the status page; it shows status only and never applies a
 * payment (the return is never proof of payment).
 */
const returnSignature = (ctx: RequestContext, attemptId: string) =>
  hmacSha256Base64Url(ctx.config.hmacSecret, `payment_return:${attemptId}`);

export async function paymentReturnUrl(ctx: RequestContext, attemptId: string): Promise<string> {
  const q = new URLSearchParams({ attempt: attemptId, t: await returnSignature(ctx, attemptId) });
  return `${ctx.config.siteOrigin}/pay/return?${q}`;
}

export async function verifyPaymentReturn(ctx: RequestContext, attemptId: string, signature: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(attemptId) || !looksLikeToken(signature)) return false;
  return timingSafeEqualString(await returnSignature(ctx, attemptId), signature);
}
