# 06 — Payments: Provider Abstraction + PesePay Adapter

Normative. The invoicing/payment business logic must not know which provider is used.

## 0. Packaging for reuse (decision)
The gateway layer is a **separate package inside this repo**: `packages/payments` → `@kuzikode/payments` (npm workspaces).
- It contains only reusable, app-independent code: the `PaymentProvider` interface and types, the PesePay adapter (encryption,
  initiate, check status, callback parsing, status mapping, amount conversion) and the mock provider.
- It has **zero imports from the app** (no D1, no invoices, no Hono). Dependencies are injected: `fetch`, config `{ integrationKey,
  encryptionKey, mode }`, and an optional logger. It runs on Workers and on Node 18+.
- Its own `package.json` (version starting `0.1.0`), README with usage examples, CHANGELOG, and tests run in CI.
- What stays in the app (`src/server/modules/payments`): attempts, payments, allocations, invoice updates, reconciliation, idempotency.
  That's Kuzikode business logic, not gateway logic.
- **Extraction later:** when a second product needs it, run `git subtree split --prefix=packages/payments -b payments-lib`, push that
  branch to a new repo `kuzikode-payments`, and publish to GitHub Packages (or npm) as `@kuzikode/payments`. The app then switches the
  workspace dependency to the published version, with no code changes. Document these exact steps in `packages/payments/README.md`.
- Why not a separate repo now: two repos means cross-repo changes, versioning and two CI pipelines while the interface is still changing,
  and the autonomous agent works and pushes in one repo. The package boundary gives the reuse benefit now at no cost.

## 1. Provider interface (`packages/payments/src/types.ts`)

```ts
export type ProviderKey = 'pesepay' | 'mock';           // 'manual' is handled by the payments service, not a provider

export interface InitiateInput {
  attemptId: string; merchantReference: string;        // ours, unique, sent to provider
  amountMinor: number; currency: string;               // validated vs invoice before calling
  description: string;                                 // "Invoice INV-2026-00012"
  returnUrl: string; resultUrl: string;                // absolute, from PUBLIC_SITE_URL
  customer?: { email?: string; phone?: string; name?: string };
  methodCode?: string;
}
export interface InitiateResult {
  providerReference: string; redirectUrl: string; pollUrl?: string; raw: RedactedJson;
}
export type NormalizedStatus =
  | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'reversed' | 'partially_paid' | 'error';
export interface StatusResult {
  providerReference: string; status: NormalizedStatus; providerStatus: string;
  amountMinor?: number; currency?: string; failureReason?: string; raw: RedactedJson;
}
export interface CallbackResult { providerReference: string; claimedStatus?: string; raw: RedactedJson }

export interface PaymentProvider {
  readonly key: ProviderKey;
  readonly displayName: string;
  readonly capabilities: { refunds: boolean; statusPolling: boolean; hostedCheckout: boolean };
  getSupportedCurrencies(): Promise<string[]>;
  getSupportedMethods(currency: string): Promise<{ code: string; name: string }[]>;
  initiatePayment(input: InitiateInput): Promise<InitiateResult>;
  checkPaymentStatus(providerReference: string): Promise<StatusResult>;
  verifyPayment(providerReference: string, expected: { amountMinor: number; currency: string }): Promise<StatusResult & { matches: boolean }>;
  processCallback(req: Request): Promise<CallbackResult>;   // parse + cheap authenticity filter; NEVER the source of truth
  refundPayment?(providerReference: string, amountMinor: number): Promise<{ status: 'pending' | 'completed' | 'failed'; providerReference?: string }>;
}
```

`registry.ts` returns the enabled providers based on `payment_providers` rows + env (mock only when
`APP_ENV !== 'production' && PAYMENTS_MOCK_ENABLED === 'true'`). Adding a new gateway = a new folder
under `providers/` + registry entry. No changes to invoice or payment services.

## 2. Payment service flow (provider-agnostic, `modules/payments/service.ts`)

**Initiate** — `POST /api/v1/portal/invoices/:id/pay` (also from public invoice link `/i/:token`),
header `Idempotency-Key` required:
1. Load invoice via portal scope (or token). Require status ∈ {issued, partially_paid, overdue}, balance > 0.
2. Amount = full outstanding balance (v1; partial self-pay amount optional behind a setting, min 1.00).
   Currency = invoice currency. It must be supported by the provider, otherwise 422 with a clear message.
3. Reuse an existing `initiated/pending` attempt for the same invoice+amount that's < 30 min old (prevents attempt spam).
4. Insert `payment_attempts` (status `created`, `merchant_reference = attemptId`), event `initiate_request`.
5. Call `provider.initiatePayment`. Save `provider_reference`, `redirect_url`, `poll_url`, status `initiated`, event.
6. Return `{ redirectUrl }`. The browser goes to the provider's hosted checkout.

**Return URL** `/pay/return?attempt=…`: shows a "Confirming your payment…" state and polls
`GET /api/v1/portal/payments/attempts/:id/status`. That endpoint calls `checkPaymentStatus` (rate-limited:
max once per 5 s per attempt). **The return URL never marks anything paid by itself.**

**Callback** `POST /api/payments/callbacks/:provider`:
1. `provider.processCallback(req)` → providerReference (+ cheap authenticity filter).
2. Record `payment_events` `callback_received` with `dedupe_hash`. Duplicates are a no-op but still return 200.
3. Look up attempt by `provider_reference` **and** confirm `merchant_reference` matches if the payload has it.
   Unknown reference → log + 200 (don't leak). Alert in the admin "unmatched" queue.
4. **Verify by calling `checkPaymentStatus`** (server→provider). Use only that result.
5. `applyStatus(attempt, verified)`: see state machine. Respond `200` quickly.

**Apply success** (only when verified status = `succeeded` AND amount == attempt.amount AND currency ==
attempt.currency AND reference matches): one atomic batch (see DB doc §11). Guards:
`UPDATE payment_attempts SET status='succeeded' WHERE id=? AND status IN ('initiated','pending')`.
If `changes = 0`, someone else already applied it → stop. `payments.attempt_id UNIQUE` +
`UNIQUE(provider_key, provider_reference)` are the final duplicate barrier. If the invoice balance is now smaller
than the amount (paid elsewhere meanwhile) → allocate up to the balance, put the remainder in `client_credits`, notify finance.
Amount/currency mismatch → attempt `error`, no payment, admin alert "Requires review".

**State machine (attempt):**
```
created → initiated → pending ─┬→ succeeded → (reversed)
                               ├→ failed | cancelled | expired | error
                               └→ partially_paid (stay non-terminal; keep reconciling)
```
Terminal states never go back to pending. `succeeded → reversed` creates a reversal: payment status
`reversed`, negative adjustment of the allocation (recorded as reversal rows, never deleting), invoice
balance restored, audit + finance alert.

**Reconciliation (cron every 10 min + admin button):** attempts in `initiated/pending/partially_paid`
with `last_checked_at` older than 5 min and age < 72 h → `checkPaymentStatus` → `applyStatus`. Backoff:
check_count-based (5 min, 10, 30, 60 …). Age ≥ 72 h and still pending → one final check, then `expired`
with reason. This is **essential for PesePay: its callbacks are never retried.**

**Manual payments (admin):** `POST /api/v1/admin/payments/manual` (permission `payments.record_manual`),
provider_key `manual`, method, amount, currency (must equal invoice currency), date, reference. Same apply logic + audit.

**Refunds:** if `provider.capabilities.refunds` → call it and track it. Otherwise (PesePay today) the admin
records a manual refund (`refunds` row, method `manual`), optionally linked to a credit note. The payment
status updates. The UI explains that the refund must be done in the PesePay merchant dashboard.

## 3. PesePay adapter — verified facts (Nov 2026; re-check https://developers.pesepay.com/llms-full.txt)

| Item | Value |
|---|---|
| Base URL production | `https://api.pesepay.com/api/payments-engine/v1` |
| Base URL sandbox | `https://api.test.sandbox.pesepay.com/payments-engine/v1` |
| Initiate (redirect/hosted) | `POST /payments/initiate` |
| Check status | `GET /payments/check-payment?referenceNumber=…` |
| Active currencies | `GET /currencies/active` |
| Methods for currency | `GET /payment-methods/for-currency?currencyCode=…` |
| Headers | `authorization: <integration key>`, `content-type: application/json` |
| Body envelope | Request and response: `{ "payload": "<base64 ciphertext>" }`. Error responses are NOT encrypted. |
| Encryption | **AES-256-CBC**. Key = the 32-character **encryption key** (UTF-8 bytes). **IV = first 16 characters of that same key.** Plaintext = UTF-8 JSON. Output base64. Padding: PKCS#7 (Node `createCipheriv` default; WebCrypto AES-CBC uses PKCS#7). Implement with WebCrypto `AES-CBC`. Write a round-trip test plus a test against a vector from the official docs/SDK if one is published. |
| Initiate plaintext fields | `amountDetails: { amount, currencyCode }`, `reasonForPayment`, `resultUrl`, `returnUrl`, optional `merchantReference`, `paymentMethodCode`, `paymentMetadata` |
| Initiate response (decrypted) | `referenceNumber`, `redirectUrl`, `pollUrl` |
| Check response (decrypted) | `referenceNumber`, `transactionStatus`, `transactionStatusCode`, `transactionStatusDescription`, `amountDetails` |
| Callback | Posted to `resultUrl` when the customer finishes or it times out. Plain JSON containing `referenceNumber`. The `Authorization` header carries your integration key (a cheap filter only, compare in constant time). **No signature. Never retried.** Always verify with check-payment. |
| Amount format | `amount` is a decimal number in major units (e.g. `10.50`). Convert from minor units with integer math → string → number. Never float arithmetic. Verify the docs' exact type. |
| Currencies | `USD`, `ZiG` from `/currencies/active`. `ZWG` also used for Zimswitch/Omari. **Sandbox: USD only; EcoCash, Visa, Mastercard.** Map internal `ZWG` ↔ provider code via the adapter mapping table after checking `/currencies/active`. |
| Refund API | None documented → `capabilities.refunds = false`. |

**Status mapping (`mapper.ts`):**

| PesePay `transactionStatus` (code) | Normalized |
|---|---|
| `INITIATED` (301), `PROCESSING` (302), `PENDING` (303) | `pending` |
| `PARTIALLY_PAID` (315) | `partially_paid` (non-terminal) |
| `SUCCESS` (304) | `succeeded` (**the only paid state**) |
| `FAILED` (300), `DECLINED` (311), `INSUFFICIENT_FUNDS` (308), `AUTHORIZATION_FAILED` (312), `ERROR` (310), `SERVICE_UNAVAILABLE` (313) | `failed` (keep the raw status as `failure_reason`) |
| `CANCELLED` (309), `TERMINATED` (305) | `cancelled` |
| `TIME_OUT` (306), `CLOSED` (307), `CLOSED_PERIOD_ELAPSED` (307) | `expired` |
| `REVERSED` (314) | `reversed` |
| anything unknown | `pending` + warning log + admin alert (never treat unknown as paid) |

**Secrets:** `PESEPAY_INTEGRATION_KEY`, `PESEPAY_ENCRYPTION_KEY` (Worker secrets only). `PESEPAY_MODE` var
selects the base URL. Admin UI shows only "configured / not configured" and the mode.

**Redaction:** before storing `payment_events.payload_redacted`, strip/mask: card numbers, phone numbers
(keep last 3), emails (mask local part), any key/token fields, and the `authorization` header.

## 4. Mock provider (dev/test only)
- Hosted page `/dev/mock-checkout/:ref` with buttons Succeed / Fail / Cancel / Partial / Timeout.
  It calls the callback endpoint the way PesePay would (plain JSON + header).
- `checkPaymentStatus` reads state from a D1 table `mock_provider_state`. The table exists in every
  environment (migrations are identical everywhere), but production can't reach it because the registry never
  enables the mock provider there and the `/dev/*` routes return 404 when `APP_ENV=production`.
- Every UI surface shows a yellow "TEST PAYMENT — no real money" banner when the mock or sandbox mode is used.
  Receipts carry a "TEST" watermark.

## 5. Required tests (in addition to 08-TESTING.md)
Encryption round-trip, status mapping table (every row), initiate validation (void/paid/draft invoice
rejected, wrong currency rejected), callback for unknown ref, duplicate callback ×5 concurrently → one payment,
callback claiming SUCCESS while check-payment says PENDING → no payment, amount mismatch → no payment +
alert, reconciliation picks up a missed callback, reversal restores balance, overpayment → client credit,
payment cannot be applied to an invoice of another client (attempt ↔ invoice ↔ client consistency check).
Sandbox integration test suite (`npm run test:sandbox`) runs only when `PESEPAY_*` sandbox secrets are
present. It initiates a real sandbox transaction and checks status. Never run in CI by default.

## 6. Production readiness gate for payments
Do not mark payments production-ready (and say so in FINAL-REPORT) until: sandbox suite passed with real
sandbox credentials, the full card/EcoCash sandbox flow was completed manually through the hosted page,
callback reached the staging URL, reconciliation verified, and production merchant credentials were set
by the owner. Until then, BLOCKERS.md lists exactly what's missing.
