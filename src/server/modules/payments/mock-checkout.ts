/**
 * The mock gateway's hosted page (`/dev/mock-checkout/:reference`, docs/06 §6): stands in for a gateway's card page in
 * development and staging. Not found unless the mock gateway is enabled (never in production).
 */
import { MOCK_OUTCOMES, type MockOutcome, ProviderError, signMockCallback } from '@kuzikode/payments';
import type { RequestContext } from '../../context';
import { notFound, validationError } from '../../lib/errors';
import { formatMoney } from '../../../shared/money';
import { accountConfig, getAccount } from './router';
import { handleCallback } from './orchestration';
import { d1MockStore, mockProvider } from './providers';

export interface MockCheckoutView {
  reference: string;
  amount: string;
  status: string;
  method: string | null;
  /** Where the browser goes after an outcome is picked (our own site only). */
  returnUrl: string | null;
}

function sameSite(ctx: RequestContext, url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, ctx.config.siteOrigin);
    return u.origin === ctx.config.siteOrigin ? `${u.pathname}${u.search}` : null;
  } catch {
    return null;
  }
}

export async function getMockCheckout(ctx: RequestContext, reference: string): Promise<MockCheckoutView> {
  if (!ctx.config.mockPaymentsEnabled) throw notFound();
  const s = await d1MockStore(ctx).get(reference);
  if (!s) throw notFound();
  return {
    reference: s.reference,
    amount: formatMoney(s.amountMinor, s.currency),
    status: s.status,
    method: s.methodCode,
    returnUrl: sameSite(ctx, s.returnUrl),
  };
}

export const isMockOutcome = (v: unknown): v is MockOutcome =>
  typeof v === 'string' && (MOCK_OUTCOMES as readonly string[]).includes(v);

/** A person picked an outcome on the mock page. The app learns it the way it learns any gateway status: by checking. */
export async function settleMockCheckout(
  ctx: RequestContext,
  reference: string,
  outcome: string,
): Promise<MockCheckoutView> {
  if (!ctx.config.mockPaymentsEnabled) throw notFound();
  if (!isMockOutcome(outcome)) throw validationError({ outcome: ['Choose one of the listed outcomes.'] });
  const state = await d1MockStore(ctx).get(reference);
  if (!state) throw notFound();
  const account = await getAccount(ctx, state.accountId);
  const built = account ? accountConfig(ctx, account) : null;
  if (!built) throw notFound();
  try {
    await mockProvider(ctx).settle(built.config, reference, outcome);
  } catch (err) {
    if (err instanceof ProviderError && err.code === 'invalid_request')
      throw validationError({ outcome: ['This test payment has already been completed.'] });
    throw err;
  }
  ctx.logger.info('mock payment settled', { reference, outcome });
  // Like a real gateway, notify our result URL with a signed status update. Delivered in-process (a Worker can't
  // reliably call its own hostname); it goes through exactly the same callback handling, including the status check.
  const settled = await d1MockStore(ctx).get(reference);
  if (settled) {
    const body = await signMockCallback(built.config, {
      reference,
      merchantReference: settled.merchantReference,
      status: settled.status,
      amountMinor: settled.paidMinor,
      currency: settled.currency,
    });
    try {
      await handleCallback(ctx, 'mock', settled.accountId, {
        headers: new Headers({ 'content-type': 'application/json' }),
        body,
        contentType: 'application/json',
      });
    } catch (err) {
      ctx.logger.error('mock callback delivery failed', { reference, err });
    }
  }
  return getMockCheckout(ctx, reference);
}
