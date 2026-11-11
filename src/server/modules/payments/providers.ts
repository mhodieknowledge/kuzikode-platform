/**
 * The adapters this app can route to (docs/06 §0). Only this file and the router know adapters exist; invoicing, the
 * portal and the checkout page only see the PaymentProvider interface. New gateway = add its factory here.
 */
import {
  createMockProvider,
  createPaynowProvider,
  type MockPaymentState,
  type MockStore,
  type NormalizedStatus,
  type PaymentProvider,
} from '@kuzikode/payments';
import type { RequestContext } from '../../context';

/** Mock gateway state in D1 (`mock_provider_state`); development and staging only. */
export function d1MockStore(ctx: RequestContext): MockStore {
  return {
    async get(reference) {
      const r = await ctx.db.prepare('SELECT * FROM mock_provider_state WHERE reference = ?').bind(reference).first<{
        reference: string;
        account_id: string;
        merchant_reference: string;
        amount_minor: number;
        paid_minor: number;
        currency: string;
        status: NormalizedStatus;
        method_code: string | null;
        result_url: string | null;
        return_url: string | null;
        scripted: NormalizedStatus | null;
        settle_at: string | null;
        otp: string | null;
        created_at: string;
      }>();
      if (!r) return null;
      return {
        reference: r.reference,
        accountId: r.account_id,
        merchantReference: r.merchant_reference,
        amountMinor: r.amount_minor,
        paidMinor: r.paid_minor,
        currency: r.currency,
        status: r.status,
        methodCode: r.method_code,
        resultUrl: r.result_url,
        returnUrl: r.return_url,
        scripted: r.scripted,
        settleAt: r.settle_at,
        otpReference: r.otp,
        createdAt: r.created_at,
      } satisfies MockPaymentState;
    },
    async save(s) {
      await ctx.db
        .prepare(
          `INSERT INTO mock_provider_state (reference, account_id, merchant_reference, amount_minor, paid_minor, currency, status,
             method_code, result_url, return_url, scripted, settle_at, otp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(reference) DO UPDATE SET status = excluded.status, paid_minor = excluded.paid_minor,
             scripted = excluded.scripted, settle_at = excluded.settle_at, otp = excluded.otp,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
        )
        .bind(
          s.reference,
          s.accountId,
          s.merchantReference,
          s.amountMinor,
          s.paidMinor,
          s.currency,
          s.status,
          s.methodCode,
          s.resultUrl,
          s.returnUrl,
          s.scripted,
          s.settleAt,
          s.otpReference,
          s.createdAt,
        )
        .run();
    },
  };
}

export const mockProvider = (ctx: RequestContext) =>
  createMockProvider({ store: d1MockStore(ctx), now: () => ctx.now(), logger: ctx.logger });

const FACTORIES: Record<string, (ctx: RequestContext) => PaymentProvider> = {
  mock: mockProvider,
  paynow: (ctx) => createPaynowProvider({ now: () => ctx.now(), logger: ctx.logger }),
};

/** Test-only adapters (never routed in production, whatever the database says). */
const TEST_ONLY = new Set(['mock']);

export function providerAllowed(ctx: RequestContext, key: string): boolean {
  return !TEST_ONLY.has(key) || ctx.config.mockPaymentsEnabled;
}

export function getProvider(ctx: RequestContext, key: string): PaymentProvider | null {
  const factory = FACTORIES[key];
  return factory ? factory(ctx) : null;
}

export const registeredProviders = () => Object.keys(FACTORIES);
