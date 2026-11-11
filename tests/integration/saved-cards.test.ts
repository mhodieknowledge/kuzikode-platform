/**
 * P6.3e cards on our checkout (docs/06 §3b) through the mock gateway: new card with "save this card" (tokenize, card
 * window return page), saved-card express payment with re-tokenization, scoping, portal management, subscription
 * auto-charge with consent (one attempt per invoice, failure email), and the token never reaching a browser or a log.
 */
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { decryptString, encryptString } from '../../src/server/lib/crypto';
import { autoChargeDueInvoices, checkoutView, settleMockCheckout } from '../../src/server/modules/payments';
import { api, login, type Session } from '../helpers/api';
import { createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 10);
const A = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });
const P = (p: Session, path: string, opts: { body?: unknown; method?: string } = {}) =>
  api(`/api/v1/portal${path}`, { cookie: p.cookie, csrf: p.csrf, ...opts });

async function staff() {
  const x = await createStaff(['admin']);
  return login('admin', x.email, x.password);
}

async function newClient(s: Session) {
  const c = await A(s, '/clients', {
    type: 'business',
    displayName: `Card payer ${u()}`,
    email: `c-${u()}@example.com`,
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
  });
  const clientId = c.body.data.id as string;
  const user = await createPortalUser([clientId], { role: 'billing' });
  return { clientId, portal: await login('portal', user.email, user.password) };
}

async function invoice(s: Session, clientId: string, amount = 25_000) {
  const d = await A(s, '/invoices', {
    clientId,
    currency: 'USD',
    items: [{ description: 'Hosting', quantity: '1', unitPriceMinor: amount, discountType: 'none', discountValue: 0 }],
  });
  const id = d.body.data.id as string;
  expect((await A(s, `/invoices/${id}/issue`, { send: false })).status).toBe(200);
  return id;
}

const pay = (p: Session, invoiceId: string, body: Record<string, unknown>) =>
  api(`/api/v1/portal/invoices/${invoiceId}/pay`, {
    cookie: p.cookie,
    csrf: p.csrf,
    body,
    headers: { 'idempotency-key': `k_${u()}${u()}` },
  });

const tokenization = (on: boolean) =>
  env.DB.prepare(
    `UPDATE payment_provider_accounts SET options = json_set(options, '$.tokenizationEnabled', json(?)) WHERE id = 'ppa_mock'`,
  )
    .bind(on ? 'true' : 'false')
    .run();

const attemptRow = (id: string) =>
  env.DB.prepare('SELECT * FROM payment_attempts WHERE id = ?').bind(id).first<Record<string, any>>();
const cardsOf = async (clientId: string) =>
  (
    await env.DB.prepare('SELECT * FROM saved_payment_methods WHERE client_id = ? ORDER BY created_at')
      .bind(clientId)
      .all<Record<string, any>>()
  ).results;

async function gatewaySays(attemptId: string, status: string) {
  await env.DB.prepare(
    `UPDATE mock_provider_state SET status = ?, scripted = NULL, settle_at = NULL WHERE merchant_reference = ?`,
  )
    .bind(status, attemptId)
    .run();
}

/** New card in the card window, saved: the mock card page succeeds. Returns the saved card row. */
async function saveCardBy(s: Session, clientId: string, portal: Session) {
  const inv = await invoice(s, clientId);
  const start = await pay(portal, inv, { methodCode: 'card', saveCard: true });
  expect(start.status, JSON.stringify(start.body)).toBe(201);
  const reference = (start.body.data.redirectUrl as string).split('/dev/mock-checkout/')[1]!;
  await settleMockCheckout(createContext({ env }), decodeURIComponent(reference), 'succeeded');
  return { invoiceId: inv, attemptId: start.body.data.attemptId as string, cards: await cardsOf(clientId) };
}

const ctx = () => createContext({ env });
const PURPOSE = 'saved_card_token';

describe('cards on our checkout (P6.3e)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
    await tokenization(false);
  });

  it('without tokenization: cards still work through the card window, nothing is saved, no saved cards offered', async () => {
    const s = await staff();
    const { clientId, portal } = await newClient(s);
    const inv = await invoice(s, clientId);
    const view = await checkoutView(ctx(), inv, { userId: 'usr_x' });
    expect(view.cards).toEqual({ saved: [], canSave: false });
    const start = await pay(portal, inv, { methodCode: 'card', saveCard: true });
    expect(start.body.data).toMatchObject({ flow: 'redirect', phase: 'waiting' });
    const row = await attemptRow(start.body.data.attemptId);
    expect(row).toMatchObject({ tokenize: 0, saved_method_id: null });
    // The gateway is told to return to the card window's return page.
    const mock = await env.DB.prepare('SELECT return_url FROM mock_provider_state WHERE merchant_reference = ?')
      .bind(row!.id)
      .first<{ return_url: string }>();
    expect(mock!.return_url).toMatch(/\/pay\/card-return\?attempt=att_[A-Za-z0-9]+&t=[A-Za-z0-9_-]+$/);
    const reference = (start.body.data.redirectUrl as string).split('/dev/mock-checkout/')[1]!;
    await settleMockCheckout(ctx(), decodeURIComponent(reference), 'succeeded');
    expect(await cardsOf(clientId)).toHaveLength(0);
  });

  it('save a new card, then pay with it on our page (re-tokenized); token encrypted, never returned or logged', async () => {
    await tokenization(true);
    const s = await staff();
    const { clientId, portal } = await newClient(s);
    const first = await saveCardBy(s, clientId, portal);
    expect(await attemptRow(first.attemptId)).toMatchObject({ tokenize: 1, status: 'succeeded' });
    expect(first.cards).toHaveLength(1);
    const card = first.cards[0]!;
    expect(card).toMatchObject({ status: 'active', method: 'vmc', brand: 'Visa', masked: '4242', is_default: 1 });
    expect(card.token_enc).not.toContain('mocktok_');
    const token1 = await decryptString(ctx().config.dataEncryptionKey, card.token_enc, PURPOSE);
    expect(token1).toMatch(/^mocktok_/);
    expect(Date.parse(card.token_expiry)).toBeGreaterThan(Date.now() + 150 * 86_400_000);

    const inv2 = await invoice(s, clientId, 12_000);
    const view = await checkoutView(ctx(), inv2, { userId: 'usr_x' });
    expect(view.cards.canSave).toBe(true);
    expect(view.cards.saved).toEqual([
      { id: card.id, brand: 'Visa', last4: '4242', expiresAt: card.token_expiry, expired: false, isDefault: true },
    ]);
    // Public links never offer saved cards.
    expect((await checkoutView(ctx(), inv2)).cards).toEqual({ saved: [], canSave: false });

    const start = await pay(portal, inv2, { methodCode: 'card', savedCardId: card.id });
    expect(start.status, JSON.stringify(start.body)).toBe(201);
    expect(start.body.data).toMatchObject({ flow: 'express', redirectUrl: null, phase: 'waiting', methodCode: 'card' });
    expect(start.body.data.instructions.text).toContain('saved card');
    const id = start.body.data.attemptId as string;
    expect(await attemptRow(id)).toMatchObject({ saved_method_id: card.id, flow: 'express', tokenize: 0 });
    await gatewaySays(id, 'succeeded');
    const st = await P(portal, `/payment-attempts/${id}`);
    expect(st.body.data.phase).toBe('succeeded');
    const after = (await cardsOf(clientId))[0]!;
    expect(await decryptString(ctx().config.dataEncryptionKey, after.token_enc, PURPOSE)).not.toBe(token1);
    expect(await cardsOf(clientId)).toHaveLength(1);

    // Nothing a browser or a log sees carries the token.
    const list = await P(portal, '/saved-cards');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ id: card.id, brand: 'Visa', last4: '4242', autoCharges: [] });
    for (const body of [list.body, start.body, st.body])
      expect(JSON.stringify(body)).not.toMatch(/mocktok_|token_enc|v1\./);
    const events = await env.DB.prepare('SELECT payload_redacted FROM payment_events').all<{
      payload_redacted: string;
    }>();
    const audits = await env.DB.prepare('SELECT before, after FROM audit_logs').all<Record<string, string>>();
    expect(JSON.stringify(events.results)).not.toContain('mocktok_');
    expect(JSON.stringify(audits.results)).not.toContain('mocktok_');
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'payment_method.saved' AND entity_id = ?`,
      )
        .bind(card.id)
        .first('n'),
    ).toBe(1);
  });

  it('a declined saved card fails at once; another client cannot use the card; expired cards are not offered', async () => {
    await tokenization(true);
    const s = await staff();
    const { clientId, portal } = await newClient(s);
    const card = (await saveCardBy(s, clientId, portal)).cards[0]!;
    const other = await newClient(s);
    const otherInv = await invoice(s, other.clientId);
    const stolen = await pay(other.portal, otherInv, { methodCode: 'card', savedCardId: card.id });
    expect(stolen.status).toBe(422);
    expect(stolen.body.error.fields.savedCardId).toBeDefined();
    // The public link takes no saved card at all (strict body).
    const declined = await encryptString(ctx().config.dataEncryptionKey, 'mocktok_44444444', PURPOSE);
    await env.DB.prepare('UPDATE saved_payment_methods SET token_enc = ? WHERE id = ?').bind(declined, card.id).run();
    const inv = await invoice(s, clientId);
    const r = await pay(portal, inv, { methodCode: 'card', savedCardId: card.id });
    expect(r.body.data.phase).toBe('failed');
    expect(r.body.data.message).toContain('declined');
    await env.DB.prepare(`UPDATE saved_payment_methods SET token_expiry = '2020-01-01T00:00:00.000Z' WHERE id = ?`)
      .bind(card.id)
      .run();
    expect((await checkoutView(ctx(), inv, { userId: 'usr_x' })).cards.saved).toEqual([]);
    expect((await pay(portal, inv, { methodCode: 'card', savedCardId: card.id })).status).toBe(422);
    expect((await P(portal, '/saved-cards')).body.data[0]).toMatchObject({ expired: true });
  });

  it('portal management: default, remove (token deleted, auto-charge stopped), scoped to the client', async () => {
    await tokenization(true);
    const s = await staff();
    const { clientId, portal } = await newClient(s);
    const first = (await saveCardBy(s, clientId, portal)).cards[0]!;
    // A second, different card (another last four digits).
    await env.DB.prepare(`UPDATE saved_payment_methods SET masked = '1111' WHERE id = ?`).bind(first.id).run();
    const second = (await saveCardBy(s, clientId, portal)).cards.find((c) => c.id !== first.id)!;
    expect(second).toMatchObject({ is_default: 0, masked: '4242' });
    expect((await P(portal, `/saved-cards/${second.id}/default`, { body: {} })).status).toBe(200);
    const rows = await cardsOf(clientId);
    expect(rows.find((c) => c.id === second.id)!.is_default).toBe(1);
    expect(rows.find((c) => c.id === first.id)!.is_default).toBe(0);

    const other = await newClient(s);
    expect((await P(other.portal, `/saved-cards/${second.id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await P(other.portal, '/saved-cards')).body.data).toEqual([]);

    expect((await P(portal, `/saved-cards/${second.id}`, { method: 'DELETE' })).status).toBe(200);
    const removed = (await cardsOf(clientId)).find((c) => c.id === second.id)!;
    expect(removed).toMatchObject({ status: 'removed', token_enc: null, is_default: 0 });
    expect((await cardsOf(clientId)).find((c) => c.id === first.id)!.is_default).toBe(1);
    expect((await P(portal, '/saved-cards')).body.data.map((c: { id: string }) => c.id)).toEqual([first.id]);
  });

  it('subscription auto-charge: consent, one attempt per due invoice, failure leaves it open and emails a pay link', async () => {
    await tokenization(true);
    const s = await staff();
    const { clientId, portal } = await newClient(s);
    const card = (await saveCardBy(s, clientId, portal)).cards[0]!;
    const subId = `sub_${u()}${u()}`;
    await env.DB.prepare(
      `INSERT INTO subscriptions (id, client_id, description, quantity_milli, unit_price_minor, currency, interval, start_date,
         next_billing_date) VALUES (?, ?, 'Managed hosting', 1000, 2500, 'USD', 'month', '2026-01-01', '2027-01-01')`,
    )
      .bind(subId, clientId)
      .run();
    const inv = await invoice(s, clientId, 2500);
    await env.DB.prepare(`UPDATE invoices SET subscription_id = ?, due_date = '2026-01-05' WHERE id = ?`)
      .bind(subId, inv)
      .run();

    // No consent yet → nothing is charged.
    await autoChargeDueInvoices(ctx());
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS n FROM payment_attempts WHERE invoice_id = ?').bind(inv).first('n'),
    ).toBe(0);

    const other = await newClient(s);
    expect(
      (
        await P(other.portal, `/services/subscriptions/${subId}/auto-charge`, {
          method: 'PUT',
          body: { cardId: card.id },
        })
      ).status,
    ).toBe(404);
    const consent = await P(portal, `/services/subscriptions/${subId}/auto-charge`, {
      method: 'PUT',
      body: { cardId: card.id },
    });
    expect(consent.status, JSON.stringify(consent.body)).toBe(200);
    expect((await cardsOf(clientId))[0]!.autocharge_consent_at).toBeTruthy();
    expect((await P(portal, '/saved-cards')).body.data[0].autoCharges).toEqual([
      { id: subId, description: 'Managed hosting' },
    ]);

    // The card is declined: the invoice stays open and the client gets one email with the pay link.
    const declined = await encryptString(ctx().config.dataEncryptionKey, 'mocktok_44444444', PURPOSE);
    await env.DB.prepare('UPDATE saved_payment_methods SET token_enc = ? WHERE id = ?').bind(declined, card.id).run();
    expect(await autoChargeDueInvoices(ctx())).toEqual({ started: 0, failed: 1 });
    expect(await autoChargeDueInvoices(ctx())).toEqual({ started: 0, failed: 0 });
    const attempts = (
      await env.DB.prepare('SELECT * FROM payment_attempts WHERE invoice_id = ?').bind(inv).all<Record<string, any>>()
    ).results;
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      idempotency_key: `${inv}:autocharge`,
      saved_method_id: card.id,
      status: 'failed',
    });
    expect(await env.DB.prepare('SELECT status FROM invoices WHERE id = ?').bind(inv).first('status')).not.toBe('paid');
    const mail = await env.DB.prepare(`SELECT payload FROM outbox WHERE idempotency_key = ?`)
      .bind(`email:card_charge_failed:${attempts[0]!.id}`)
      .first<{ payload: string }>();
    expect(JSON.parse(mail!.payload)).toMatchObject({
      template: 'card_charge_failed',
      data: { amount: '$25.00', link: expect.stringMatching(/\/pay\/[A-Za-z0-9_-]{20,}$/) },
    });

    // A second due invoice with a working card is charged.
    const ok = await encryptString(ctx().config.dataEncryptionKey, 'mocktok_working1', PURPOSE);
    await env.DB.prepare('UPDATE saved_payment_methods SET token_enc = ? WHERE id = ?').bind(ok, card.id).run();
    const inv2 = await invoice(s, clientId, 2500);
    await env.DB.prepare(`UPDATE invoices SET subscription_id = ?, due_date = '2026-02-05' WHERE id = ?`)
      .bind(subId, inv2)
      .run();
    expect(await autoChargeDueInvoices(ctx())).toEqual({ started: 1, failed: 0 });

    // Withdrawing consent stops future charges (audited).
    expect(
      (await P(portal, `/services/subscriptions/${subId}/auto-charge`, { method: 'PUT', body: { cardId: null } }))
        .status,
    ).toBe(200);
    expect(
      await env.DB.prepare('SELECT autocharge_method_id FROM subscriptions WHERE id = ?')
        .bind(subId)
        .first('autocharge_method_id'),
    ).toBeNull();
    const actions = (
      await env.DB.prepare(`SELECT action FROM audit_logs WHERE entity_id = ? ORDER BY created_at`)
        .bind(subId)
        .all<{ action: string }>()
    ).results.map((r) => r.action);
    expect(actions).toEqual(['subscription.autocharge_enabled', 'subscription.autocharge_disabled']);
  });
});
