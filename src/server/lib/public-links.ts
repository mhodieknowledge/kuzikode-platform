/**
 * Public document links (`/q/<token>`, `/i/<token>`…). The token is derived — HMAC of the kind and id — so the same
 * link can be shown again or re-sent without storing it; only its SHA-256 is stored, for lookup.
 */
import type { RequestContext } from '../context';
import { hmacSha256Base64Url, sha256Hex } from './crypto';

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
