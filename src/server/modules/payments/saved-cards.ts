/**
 * Saved cards (docs/06 §3b rules 2, 4, 5). A card is saved from a verified, tokenized card payment made by a signed-in
 * portal user who ticked "Save this card"; later payments with it are express payments on our own page. The token is
 * encrypted at rest (AES-GCM with `DATA_ENCRYPTION_KEY`, purpose-bound), never logged and never sent to a browser: the
 * browser only ever sees the card's id, brand, last four digits and expiry.
 *
 * Gateway re-tokenization: every paid card-token payment returns a fresh token, which replaces the stored one.
 * Tokens last up to 6 months (capped by the card's expiry); an expired card is shown as expired and never charged.
 */
import type { CardScheme, CardTokenResult } from '@kuzikode/payments';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { encryptString } from '../../lib/crypto';
import { openData, reencryptColumn } from '../../lib/data-keys';
import { notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { clientScope, portalAreaClientIds } from '../../lib/policies';
import { resolveRoute, type ResolvedRoute } from './router';

const PURPOSE = 'saved_card_token';
const TOKEN_MAX_DAYS = 183;
const CARD_METHOD = 'card';

export interface SavedCardRow {
  id: string;
  client_id: string;
  created_by_user_id: string | null;
  account_id: string;
  provider_key: string;
  method: CardScheme;
  token_enc: string | null;
  brand: string | null;
  masked: string | null;
  token_expiry: string | null;
  is_default: number;
  autocharge_consent_at: string | null;
  autocharge_consent_by: string | null;
  status: 'active' | 'expired' | 'removed';
  removed_at: string | null;
  created_at: string;
}

/** What a browser may see about a saved card. */
export interface SavedCardView {
  id: string;
  brand: string;
  last4: string | null;
  expiresAt: string | null;
  expired: boolean;
  isDefault: boolean;
}

const expiredAt = (ctx: RequestContext, c: Pick<SavedCardRow, 'token_expiry'>) =>
  !!c.token_expiry && c.token_expiry <= ctx.now().toISOString();

export function savedCardView(ctx: RequestContext, c: SavedCardRow): SavedCardView {
  return {
    id: c.id,
    brand: c.brand ?? (c.method === 'zimswitch' ? 'Zimswitch' : 'Card'),
    last4: c.masked,
    expiresAt: c.token_expiry,
    expired: c.status === 'expired' || expiredAt(ctx, c),
    isDefault: c.is_default === 1,
  };
}

/** "Visa •••• 4242". */
export const savedCardLabel = (c: Pick<SavedCardView, 'brand' | 'last4'>) =>
  c.last4 ? `${c.brand} •••• ${c.last4}` : c.brand;

/** The route that takes card payments for this currency, when its gateway can tokenize (else null). */
export async function tokenizingCardRoute(ctx: RequestContext, currency: string): Promise<ResolvedRoute | null> {
  const route = await resolveRoute(ctx, { currency, methodCode: CARD_METHOD });
  return route && route.provider.capabilities(route.config).tokenization ? route : null;
}

/** Usable saved cards of a client on one gateway account (default first). */
export async function usableCards(ctx: RequestContext, clientId: string, accountId: string): Promise<SavedCardRow[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT * FROM saved_payment_methods WHERE client_id = ? AND account_id = ? AND status = 'active'
         AND (token_expiry IS NULL OR token_expiry > ?) ORDER BY is_default DESC, created_at DESC`,
    )
    .bind(clientId, accountId, ctx.now().toISOString())
    .all<SavedCardRow>();
  return results;
}

/** For the checkout: the saved cards the payer could use for this invoice, and whether a new card may be saved. */
export async function checkoutCards(
  ctx: RequestContext,
  inv: { clientId: string; currency: string },
  opts: { portalUser: boolean },
): Promise<{ savedCards: SavedCardView[]; canSaveCard: boolean }> {
  // Public invoice links never see or use saved cards: anyone holding the link could otherwise charge the client's card.
  if (!opts.portalUser) return { savedCards: [], canSaveCard: false };
  const route = await tokenizingCardRoute(ctx, inv.currency);
  if (!route) return { savedCards: [], canSaveCard: false };
  const cards = await usableCards(ctx, inv.clientId, route.account.id);
  return { savedCards: cards.map((c) => savedCardView(ctx, c)), canSaveCard: true };
}

/** The decrypted token of a usable card for this client and account. Server-only. */
export async function cardForPayment(
  ctx: RequestContext,
  cardId: string,
  clientId: string,
  accountId: string,
): Promise<{ card: SavedCardRow; token: string }> {
  const card = (await usableCards(ctx, clientId, accountId)).find((c) => c.id === cardId);
  if (!card?.token_enc)
    throw validationError({ savedCardId: ['This saved card can no longer be used. Choose another card.'] });
  return { card, token: await openData(ctx, card.token_enc, PURPOSE) };
}

function tokenExpiry(ctx: RequestContext, t: CardTokenResult): string {
  const cap = new Date(ctx.now().getTime() + TOKEN_MAX_DAYS * 86_400_000).toISOString();
  return t.expiresAt && t.expiresAt < cap ? t.expiresAt : cap;
}

interface CaptureAttempt {
  id: string;
  client_id: string;
  account_id: string;
  provider_key: string;
  initiated_by_user_id: string | null;
  saved_method_id: string | null;
  tokenize: number;
}

/**
 * Stores the token a verified, paid card payment returned: replaces the token of the saved card that was charged
 * (re-tokenization), or saves the new card when the payer asked for it. Idempotent (a repeated status check updates the
 * same card). The token itself is never logged or audited.
 */
export async function captureCardToken(ctx: RequestContext, a: CaptureAttempt, t: CardTokenResult): Promise<void> {
  const enc = await encryptString(ctx.config.dataEncryptionKey, t.token, PURPOSE);
  const now = ctx.now().toISOString();
  const expiry = tokenExpiry(ctx, t);
  if (a.saved_method_id) {
    await stmt(
      ctx.db,
      `UPDATE saved_payment_methods SET token_enc = ?, token_expiry = ?, updated_at = ?
       WHERE id = ? AND client_id = ? AND status = 'active'`,
      enc,
      expiry,
      now,
      a.saved_method_id,
      a.client_id,
    ).run();
    return;
  }
  if (a.tokenize !== 1) return;
  // The same card saved again (same last four digits and brand) refreshes the existing entry instead of adding one.
  const same = await ctx.db
    .prepare(
      `SELECT id FROM saved_payment_methods WHERE client_id = ? AND account_id = ? AND status = 'active'
         AND method = ? AND COALESCE(masked, '') = ? AND COALESCE(brand, '') = ?`,
    )
    .bind(a.client_id, a.account_id, t.scheme, t.last4 ?? '', t.brand ?? '')
    .first<{ id: string }>();
  if (same) {
    await stmt(
      ctx.db,
      'UPDATE saved_payment_methods SET token_enc = ?, token_expiry = ?, updated_at = ? WHERE id = ?',
      enc,
      expiry,
      now,
      same.id,
    ).run();
    return;
  }
  const id = newId('spm', ctx.now().getTime());
  const view = { brand: t.brand ?? 'Card', last4: t.last4 };
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO saved_payment_methods (id, client_id, created_by_user_id, account_id, provider_key, method, token_enc, brand,
           masked, token_expiry, is_default, status, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           CASE WHEN EXISTS (SELECT 1 FROM saved_payment_methods WHERE client_id = ? AND status = 'active' AND is_default = 1)
             THEN 0 ELSE 1 END, 'active', ?, ?`,
        id,
        a.client_id,
        a.initiated_by_user_id,
        a.account_id,
        a.provider_key,
        t.scheme,
        enc,
        t.brand,
        t.last4,
        expiry,
        a.client_id,
        now,
        now,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_method.saved',
        entityType: 'saved_payment_method',
        entityId: id,
        after: { clientId: a.client_id, card: savedCardLabel(view), attemptId: a.id },
        actorType: 'provider',
        actorUserId: null,
      }),
    )
    .run();
}

// ---------------------------------------------------------------- portal management

const scope = (ctx: RequestContext, column: string) => clientScope(column, portalAreaClientIds(ctx, 'finance'));

export interface PortalSavedCard extends SavedCardView {
  clientId: string;
  clientName: string;
  /** Subscriptions this card pays automatically. */
  autoCharges: { id: string; description: string }[];
}

export async function listPortalSavedCards(ctx: RequestContext): Promise<PortalSavedCard[]> {
  const s = scope(ctx, 'm.client_id');
  const { results } = await ctx.db
    .prepare(
      `SELECT m.*, c.display_name AS client_name,
         (SELECT json_group_array(json_object('id', s.id, 'description', s.description)) FROM subscriptions s
           WHERE s.autocharge_method_id = m.id AND s.status IN ('active','at_risk','paused')) AS auto_charges
       FROM saved_payment_methods m JOIN clients c ON c.id = m.client_id
       WHERE m.status IN ('active','expired') AND ${s.sql} ORDER BY c.display_name, m.is_default DESC, m.created_at DESC`,
    )
    .bind(...s.params)
    .all<SavedCardRow & { client_name: string; auto_charges: string | null }>();
  return results.map((r) => ({
    ...savedCardView(ctx, r),
    clientId: r.client_id,
    clientName: r.client_name,
    autoCharges: r.auto_charges ? (JSON.parse(r.auto_charges) as PortalSavedCard['autoCharges']) : [],
  }));
}

async function portalCard(ctx: RequestContext, id: string): Promise<SavedCardRow> {
  const s = scope(ctx, 'client_id');
  const card = await ctx.db
    .prepare(`SELECT * FROM saved_payment_methods WHERE id = ? AND status IN ('active','expired') AND ${s.sql}`)
    .bind(id, ...s.params)
    .first<SavedCardRow>();
  if (!card) throw notFound();
  return card;
}

export async function setDefaultCard(ctx: RequestContext, id: string): Promise<void> {
  const card = await portalCard(ctx, id);
  if (card.status !== 'active' || expiredAt(ctx, card))
    throw validationError({ id: ['An expired card cannot be the default.'] });
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE saved_payment_methods SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END, updated_at = ?
         WHERE client_id = ? AND status IN ('active','expired')`,
        card.id,
        now,
        card.client_id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_method.default_set',
        entityType: 'saved_payment_method',
        entityId: card.id,
        after: { clientId: card.client_id },
      }),
    )
    .run();
}

/** Removes a card: the token is deleted, and any subscription it paid automatically stops doing so. */
export async function removeCard(ctx: RequestContext, id: string): Promise<void> {
  const card = await portalCard(ctx, id);
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE saved_payment_methods SET status = 'removed', token_enc = NULL, is_default = 0, autocharge_consent_at = NULL,
           autocharge_consent_by = NULL, removed_at = ?, updated_at = ? WHERE id = ?`,
        now,
        now,
        card.id,
      ),
    )
    .add(
      stmt(
        ctx.db,
        'UPDATE subscriptions SET autocharge_method_id = NULL, updated_at = ? WHERE autocharge_method_id = ?',
        now,
        card.id,
      ),
    )
    // The newest other active card becomes the default when the default is removed.
    .add(
      stmt(
        ctx.db,
        `UPDATE saved_payment_methods SET is_default = 1 WHERE id = (
           SELECT id FROM saved_payment_methods WHERE client_id = ? AND status = 'active' AND id <> ?
           ORDER BY created_at DESC LIMIT 1)
         AND NOT EXISTS (SELECT 1 FROM saved_payment_methods WHERE client_id = ? AND status = 'active' AND is_default = 1)`,
        card.client_id,
        card.id,
        card.client_id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_method.removed',
        entityType: 'saved_payment_method',
        entityId: card.id,
        before: { card: savedCardLabel(savedCardView(ctx, card)) },
        after: { clientId: card.client_id },
      }),
    )
    .run();
}

/**
 * The client's explicit consent ("Charge my saved card automatically for this plan"), or withdrawing it (`cardId` null).
 * The card must belong to the subscription's client and work for its currency. Audited either way.
 */
export async function setSubscriptionAutoCharge(
  ctx: RequestContext,
  subscriptionId: string,
  cardId: string | null,
): Promise<void> {
  const s = scope(ctx, 'client_id');
  const sub = await ctx.db
    .prepare(
      `SELECT id, client_id, currency, description, autocharge_method_id FROM subscriptions
       WHERE id = ? AND status IN ('active','at_risk','paused') AND ${s.sql}`,
    )
    .bind(subscriptionId, ...s.params)
    .first<{
      id: string;
      client_id: string;
      currency: string;
      description: string;
      autocharge_method_id: string | null;
    }>();
  if (!sub) throw notFound();
  const now = ctx.now().toISOString();
  if (!cardId) {
    if (!sub.autocharge_method_id) return;
    await new Batch(ctx.db)
      .add(
        stmt(ctx.db, 'UPDATE subscriptions SET autocharge_method_id = NULL, updated_at = ? WHERE id = ?', now, sub.id),
      )
      .add(
        auditStmt(ctx, {
          action: 'subscription.autocharge_disabled',
          entityType: 'subscription',
          entityId: sub.id,
          before: { cardId: sub.autocharge_method_id },
        }),
      )
      .run();
    return;
  }
  const route = await tokenizingCardRoute(ctx, sub.currency);
  const card = route ? (await usableCards(ctx, sub.client_id, route.account.id)).find((c) => c.id === cardId) : null;
  if (!card) throw validationError({ cardId: ['This card cannot pay this plan. Choose another card.'] });
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE subscriptions SET autocharge_method_id = ?, updated_at = ? WHERE id = ?',
        card.id,
        now,
        sub.id,
      ),
    )
    .add(
      stmt(
        ctx.db,
        `UPDATE saved_payment_methods SET autocharge_consent_at = ?, autocharge_consent_by = ?, updated_at = ? WHERE id = ?`,
        now,
        ctx.actor.userId,
        now,
        card.id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'subscription.autocharge_enabled',
        entityType: 'subscription',
        entityId: sub.id,
        after: {
          cardId: card.id,
          card: savedCardLabel(savedCardView(ctx, card)),
          consent: 'Charge my saved card automatically for this plan',
        },
      }),
    )
    .run();
}

/**
 * For the portal services page: per subscription, the cards that could pay it automatically and the one that does.
 * Empty `cards` (no tokenizing gateway, no saved card) → no auto-charge control is shown.
 */
export async function portalAutoChargeOptions(
  ctx: RequestContext,
  subscriptionIds: string[],
): Promise<Record<string, { current: string | null; cards: SavedCardView[] }>> {
  const out: Record<string, { current: string | null; cards: SavedCardView[] }> = {};
  if (!subscriptionIds.length) return out;
  const s = scope(ctx, 'client_id');
  const { results } = await ctx.db
    .prepare(
      `SELECT id, client_id, currency, autocharge_method_id FROM subscriptions
       WHERE id IN (${subscriptionIds.map(() => '?').join(', ')}) AND status IN ('active','at_risk','paused') AND ${s.sql}`,
    )
    .bind(...subscriptionIds, ...s.params)
    .all<{ id: string; client_id: string; currency: string; autocharge_method_id: string | null }>();
  const routes = new Map<string, ResolvedRoute | null>();
  for (const sub of results) {
    if (!routes.has(sub.currency)) routes.set(sub.currency, await tokenizingCardRoute(ctx, sub.currency));
    const route = routes.get(sub.currency);
    const cards = route ? await usableCards(ctx, sub.client_id, route.account.id) : [];
    out[sub.id] = {
      current: cards.some((c) => c.id === sub.autocharge_method_id) ? sub.autocharge_method_id : null,
      cards: cards.map((c) => savedCardView(ctx, c)),
    };
  }
  return out;
}

/** Nightly during a DATA_ENCRYPTION_KEY rotation: moves saved-card tokens to the current key (RUNBOOK). */
export function reencryptCardTokens(ctx: RequestContext) {
  return reencryptColumn(ctx, 'cardTokens');
}
