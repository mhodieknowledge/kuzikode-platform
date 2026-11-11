# 06 — Payments: Gateway-Independent Payment System (Paynow first, PesePay ready)

Normative. **Owner decision (2026-11-05): Paynow is the launch gateway.** The system must be **gateway-independent**:
- switching Kuzikode from Paynow to PesePay (or running both) is a **settings change**, not a code change;
- different products/apps (this platform today, Kuzikode Business Suite and client projects later) can each use **different gateways
  and different merchant accounts**;
- adding a new gateway later = writing one adapter, nothing else changes.

Invoicing, portal, receipts and reports must never import gateway-specific code or branch on a gateway name.

---

## 0. Three layers

```
┌───────────────────────────── App (this repo: src/server/modules/payments) ─────────────────────────────┐
│ Payment ORCHESTRATION (Kuzikode business logic)                                                         │
│  attempts · payments · allocations to invoices · reconciliation · idempotency · audit · receipts       │
│  PaymentRouter: picks a provider ACCOUNT for (app, currency, method) from DB routing rules              │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                               │ only talks to the PaymentProvider interface
┌──────────────────────────── packages/payments  (@kuzikode/payments, reusable) ──────────────────────────┐
│ Gateway LIBRARY: types + PaymentProvider interface + adapters                                           │
│   providers/paynow   (launch gateway: redirect + express checkout, SHA-512 hash)                        │
│   providers/pesepay  (alternative: redirect, AES-256-CBC)                                              │
│   providers/mock     (dev/test only)                                                                    │
│ Zero app imports. Injected: fetch, credentials, mode, logger, clock. Runs on Workers + Node 18+.        │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                               │ HTTPS
                                Paynow · PesePay · (future gateways)
```

**Packaging & reuse:** `packages/payments` is an npm workspace package with its own `package.json` (start `0.1.0`), README (usage
for each adapter, how to write a new adapter, extraction steps), CHANGELOG and tests in CI. When another product needs it:
`git subtree split --prefix=packages/payments -b payments-lib` → push to new repo `kuzikode-payments` → publish to GitHub Packages
as `@kuzikode/payments`. The app then depends on the published version, with no code changes. A separate repo isn't created now:
two repos means cross-repo changes while the interface is still settling, and the agent works in one repo.

**Future option (documented only, not built now):** the orchestration layer can be exposed as an internal "Kuzikode Payments" HTTP API
so other Kuzikode apps share one merchant setup. The tables below already carry `app_key` to make that possible.

---

## 1. Provider interface (`packages/payments/src/types.ts`)

```ts
export type ProviderKey = 'paynow' | 'pesepay' | 'mock';   // open union: new adapters add keys
export type CheckoutFlow = 'redirect' | 'express';          // express = pay inside our page (e.g. EcoCash USSD push)

export interface ProviderCapabilities {
  flows: CheckoutFlow[];
  methods: { code: string; name: string; flow: CheckoutFlow; needs?: ('phone' | 'otp' | 'token')[] }[];
  currencies: string[];              // ISO-style codes as WE use them ('USD','ZWG'); the adapter maps to gateway codes
  refunds: boolean; statusPolling: boolean; signedCallbacks: boolean; tokenization: boolean; hostedCardFields: boolean; // false for Paynow today
}

export interface ProviderConfig {     // built by the app from a provider ACCOUNT + Worker secrets
  accountId: string; mode: 'test' | 'live';
  credentials: Record<string, string>;            // e.g. { integrationId, integrationKey } or { integrationKey, encryptionKey }
  options?: Record<string, unknown>;              // e.g. { testAuthEmail } for Paynow test mode
}

export interface InitiateInput {
  merchantReference: string;          // ours, unique per attempt
  amountMinor: number; currency: string; description: string;
  returnUrl: string; resultUrl: string;
  flow: CheckoutFlow; methodCode?: string; phone?: string;
  customer?: { email?: string; phone?: string; name?: string };
}
export type InitiateResult =
  | { kind: 'redirect'; providerReference?: string; redirectUrl: string; pollUrl?: string; raw: Redacted }
  | { kind: 'express_pending'; providerReference?: string; pollUrl?: string; customerInstructions?: string;
      authorizationCode?: string; authorizationExpiresAt?: string; otpRequired?: { otpReference: string; submitUrl: string }; raw: Redacted };

export type NormalizedStatus =
  | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'partially_paid' | 'disputed' | 'refunded' | 'reversed' | 'error';

export interface StatusResult {
  status: NormalizedStatus; providerStatus: string; providerReference?: string; merchantReference?: string;
  amountMinor?: number; currency?: string; failureReason?: string; raw: Redacted;
}

export interface PaymentProvider {
  readonly key: ProviderKey; readonly displayName: string;
  capabilities(config: ProviderConfig): ProviderCapabilities;
  initiatePayment(config: ProviderConfig, input: InitiateInput): Promise<InitiateResult>;
  checkPaymentStatus(config: ProviderConfig, ref: { pollUrl?: string; providerReference?: string; merchantReference?: string }): Promise<StatusResult>;
  /** Parse + authenticate an inbound callback. Returns what it CLAIMS. The app must still confirm via checkPaymentStatus. */
  parseCallback(config: ProviderConfig, req: { headers: Headers; body: string; contentType: string }): Promise<{ authentic: boolean; claimed: StatusResult }>;
  submitOtp?(config: ProviderConfig, input: { submitUrl: string; otp: string }): Promise<StatusResult>;
  refundPayment?(config: ProviderConfig, input: { providerReference: string; amountMinor: number }): Promise<{ status: 'pending'|'completed'|'failed'; providerReference?: string }>;
}
```

Also in the package: `money.ts` (minor ↔ "12.34" decimal strings, integer-only), `errors.ts` (`ProviderError` with
`retryable` flag, safe message), `redact.ts`, and a **conformance test kit** (`test/conformance.ts`) that every adapter must pass.
It's the proof that adapters are interchangeable.

---

## 2. Accounts and routing (the switch from Paynow to PesePay is data, not code)

**`payment_provider_accounts`** (DB, admin-managed, Super Admin only): id, `provider_key`, label ("Paynow USD", "PesePay main"),
`mode` (`test`|`live`), `secret_prefix` (e.g. `PAYNOW_USD`), the Worker reads `${secret_prefix}_INTEGRATION_ID` and
`${secret_prefix}_INTEGRATION_KEY`, or for PesePay `${prefix}_INTEGRATION_KEY` / `${prefix}_ENCRYPTION_KEY`), `currencies` JSON,
`enabled_methods` JSON, non-secret `options` JSON (e.g. Paynow `testAuthEmail`), `enabled`, `status_note`.
**Secrets are never stored in D1.** The admin UI shows "credentials found / missing" per account.

**`payment_routes`**: id, `app_key` (`kuzikode-platform` now; `business-suite` etc. later), `currency` (or `*`),
`method_code` (or `*`), `account_id`, `priority`, `enabled`. The router picks the enabled route with the most specific match and lowest
priority whose account has credentials and supports the currency/method. If no route matches, the "Pay now" button is hidden and admins get an alert.

Examples:
| app_key | currency | method | account | meaning |
|---|---|---|---|---|
| kuzikode-platform | USD | * | Paynow USD | launch setup |
| kuzikode-platform | ZWG | * | Paynow ZWG | Paynow may need a separate integration per currency (verify) |
| business-suite | * | * | PesePay main | a future product using a different gateway |

**Switching gateway** = add the new account (+ its Worker secrets), change the route, done. Existing attempts keep their own `account_id`,
so in-flight payments and reconciliation still use the gateway they started on.

---

## 3. Orchestration flow (provider-agnostic, `src/server/modules/payments`)

**Payment options:** `GET /api/v1/portal/invoices/:id/payment-options` → the router resolves the account, returns methods from capabilities
(e.g. "EcoCash", "OneMoney", "InnBucks", "Card / other via Paynow page").

**Initiate:** `POST /api/v1/portal/invoices/:id/pay` (also from `/i/:token`), `Idempotency-Key` required, body `{ methodCode?, phone?, flow }`:
1. Load invoice in scope. Require status ∈ {issued, partially_paid, overdue}, balance > 0, currency supported by the routed account.
2. Amount = outstanding balance (partial self-pay optional behind a setting).
3. Reuse an open attempt (same invoice + amount + account + method, < 30 min old) instead of creating a new one.
4. Insert `payment_attempts` (`created`, `merchant_reference` = attempt id, `account_id`, `provider_key`, `flow`, `method_code`), event.
5. `provider.initiatePayment(config, …)` → store refs/poll URL → status `initiated`.
6. Express flow (default for mobile money): return instructions ("Approve the EcoCash prompt on 077…", InnBucks code + QR + deep link,
   or O'mari OTP form). The page then polls our status endpoint.

**Callback:** `POST /api/payments/callbacks/:provider/:accountId` (the account in the URL tells us which key verifies it):
1. `parseCallback` (Paynow: verify SHA-512 hash, PesePay: authorization-header filter). Record a `payment_events` row (dedupe hash).
   Not authentic → log + alert, respond 200, apply nothing.
2. Find the attempt by merchant/provider reference **within that account**. Unknown → unmatched queue.
3. **Confirm with `checkPaymentStatus`** (server → gateway). Only that result is applied.
4. Respond `200 OK` quickly. (Paynow resends status updates up to 10 times if we return an HTTP error, and the handler is idempotent.)

**Return URL** points back to **our checkout page** (`/pay/…?attempt=…`, see §3b), which shows the live status (our endpoint is polled, and checks the gateway at most once per 5 s per attempt). Redirect flow is used **only for card entry**.
**Never treats the browser return as proof of payment.**

**Apply** (verified `succeeded` + amount == attempt amount + currency == attempt currency + reference matches + attempt's invoice/client consistent):
one atomic batch, guarded by `UPDATE payment_attempts SET status='succeeded' WHERE id=? AND status IN ('initiated','pending','partially_paid')`
(check `changes`), with `payments.attempt_id UNIQUE` and `UNIQUE(provider_key, account_id, provider_reference)` as final duplicate barriers.
Balance smaller than amount (paid elsewhere meanwhile) → allocate up to balance, remainder → client credit + finance alert.
Mismatch → attempt `error`, no payment, "Requires review" alert.

**State machine (attempt):**
```
created → initiated → pending ─┬→ succeeded ─┬→ disputed → (succeeded | reversed)
                               │             ├→ refunded (provider-side)
                               │             └→ reversed
                               ├→ partially_paid (non-terminal; keep reconciling)
                               └→ failed | cancelled | expired | error
```
`disputed` (Paynow "Disputed"): keep the payment, flag the invoice, alert finance. `reversed`/`refunded` from the gateway: record a reversal or
refund (never delete), restore the invoice balance, audit + alert.

**Reconciliation (cron every 10 min + admin "Re-check" button):** attempts in `initiated|pending|partially_paid` older than 2 min and younger than
72 h → `checkPaymentStatus` → apply. Backoff by `check_count` (2, 5, 10, 30, 60 min …). Past 72 h → one final check → `expired`. Also re-check
`succeeded` payments from the last 7 days once a day for late `disputed`/`refunded`/`reversed`.

**Manual payments** (bank transfer, cash, etc.): `provider_key='manual'`, same apply logic, permission `payments.record_manual`, audited.
**Refunds:** if `capabilities.refunds` → call adapter. Otherwise (Paynow and PesePay: no refund API documented) record a manual refund
(+ optional credit note), and the UI tells finance to complete it in the gateway's merchant dashboard.

---

## 3b. Custom checkout page (required. Do NOT use the gateway's checkout page as the payment UI)

**Owner requirement:** customers pay on **Kuzikode's own branded checkout page**, not on Paynow's or PesePay's hosted pages.
The gateway works in the background through its API. Our page owns the whole experience: method choice, phone entry, waiting state,
success/failure, and the receipt.

**Routes:** `/pay/[invoiceToken]` (from emails / public invoice link) and `/portal/invoices/[id]/pay` (logged-in). Both render the same
`CheckoutPage` component. Mobile-first, works on slow networks, no third-party scripts except Turnstile, `noindex`, `no-store`.

**Layout:**
1. **Order summary** (left/top): Kuzikode logo, invoice number, client name, line-item summary, total, amount already paid,
   **amount due now**, currency, and a "TEST PAYMENT" banner when the routed account is in test mode.
2. **Choose how to pay**: method tiles from the routed account's capabilities, each with its official logo (from the gateway's
   artwork/brand kit, used per their guidelines) and a one-line hint:
   - **EcoCash**, **OneMoney**: enter phone number (Zimbabwe format validation, pre-filled from the client profile). "Pay $X" → we call
     express checkout → screen shows *"Check your phone: approve the EcoCash prompt and enter your PIN"* with a live countdown and spinner.
   - **InnBucks**: show the authorization **code**, a **QR code** (generated in our page, no external chart service) and an "Open InnBucks app"
     deep-link button (`com.innbucks.customer://purchase?paymentToken=…`), plus the code's expiry time.
   - **O'mari**: phone number → an OTP is sent → our page shows an OTP input (6 boxes, auto-advance, paste support) → we submit it to
     the gateway's `remoteotpurl` server-side.
   - **Bank card (Visa / Mastercard / Zimswitch)**: see the card rule below.
   - **Bank transfer / manual**: shows Kuzikode's bank details and invoice reference from Settings, plus "I've paid, notify Kuzikode"
     (creates a pending-confirmation note for finance. It does **not** mark anything paid).
3. **Live status panel:** polls our `GET …/attempts/:id/status` every 3 s (max 10 min, then "Still waiting? Check again" button),
   with states *Waiting for approval → Confirming → Paid ✓ / Failed ✕ / Cancelled / Expired*. On success: confetti-free, calm
   confirmation, amount, reference, **Download receipt (PDF)** and **Back to invoice / portal**. On failure: the reason in plain language
   ("Insufficient balance", "You cancelled on your phone"), plus **Try again** and **Choose another method**.
4. **Trust footer:** "Payments are processed securely by our payment partner. Kuzikode never sees or stores your PIN or card number."
   Small gateway attribution if the gateway's terms require it.

**Card payments with Paynow only (owner decision: Paynow is the only gateway; cards must stay; no gateway checkout page as the UI):**

Facts that constrain the design (verified on developers.paynow.co.zw, Nov 2026, full doc list checked): Paynow's API does **not** accept raw
card numbers (express checkout `vmc`/`zimswitch` only accepts a **token** from a previous tokenized payment), Paynow offers **no embeddable
card fields**, and paynow.co.zw sends `X-Frame-Options: SAMEORIGIN` (it can't be shown in an iframe). Building our own card inputs is
**forbidden**: card data would pass through our page and server, which puts Kuzikode in full PCI DSS scope, and Paynow would reject it anyway.
So the design minimises Paynow's card screen to a **one-time, in-context step per card**:

1. **Card tile on our checkout:** "Visa / Mastercard / Zimswitch". If the client has a **saved card**, show it first: "Visa •••• 1234 · expires 08/27 → Pay $X".
2. **Saved card → 100% on our page:** express checkout with `method=vmc` (or `zimswitch`) + `token` + a unique `merchanttrace` (prevents
   double debits on timeouts). The customer clicks Pay and our status panel shows Confirming → Paid. No Paynow screen at all.
3. **New card → secure card window (once per card):** clicking "Pay with a new card" opens Paynow's card entry in a **centred popup window**
   (`window.open`, 480×720, opened directly from the click so browsers don't block it) **on top of our checkout**. Our checkout stays visible behind
   it with a "Complete card entry in the secure window…" state and live status polling. The initiate request sets `tokenize=true`. Paynow's
   `returnurl` points to our small `/pay/card-return` page, which sends `postMessage` to our checkout (same origin) and closes itself. Our
   checkout then shows the result and receipt. The card token (+ `tokenexpiry`, masked number from `paymentinstrument`) is saved, so **every later
   payment with that card is step 2.** If popups are blocked or on small phones, fall back to a same-tab hand-off that returns to our checkout.
   The text always says: *"For your security, card details are entered once in Paynow's secure window. Kuzikode never sees your card number."*
4. **Saved-card management in the portal:** list saved cards (masked number + expiry), set default, remove (deletes the token).
   Tokens are encrypted at rest (AES-GCM, `DATA_ENCRYPTION_KEY`), never logged, never sent to the browser. Tokens last up to 6 months
   (capped by card expiry), so re-prompt when expired.
5. **Subscriptions:** with a saved card and the client's explicit consent ("Charge my saved card automatically for this plan"), the billing cron charges the
   token on the due date. Failed charge → invoice stays open, client is emailed a pay link. Consent and every charge are audited.
6. **Before Paynow approves tokenization** (`capabilities.tokenization = false`): step 3 still works through the popup (without saving the card), so
   cards are accepted from day one. Saved cards and auto-charge switch on automatically once the account option `tokenizationEnabled` is set.
**As built (P6.3e):** saved cards are offered and saved only for signed-in portal payers (a public invoice link is a bearer link), and
saving is an unticked opt-in on the checkout. The card window reports back through `postMessage` and a `BroadcastChannel`; COOP is
`same-origin-allow-popups` on the checkout pages and `unsafe-none` on `/pay/card-return`, so the popup keeps its opener (see DECISIONS).
The Super Admin turns saved cards on per gateway account (`tokenizationEnabled`). A failed automatic charge sends `card_charge_failed`.

7. **Future:** if Paynow later offers embeddable card fields or a direct card API, add it as a new adapter capability (`hostedCardFields`).
   The checkout page structure doesn't change.

**Other requirements:** keyboard accessible, screen-reader announcements for status changes (`aria-live`), 44 px touch targets, works without
JavaScript for the summary and bank-transfer details (methods need JS), Turnstile on the pay action for public token pages, rate limits
from docs/07, `Idempotency-Key` per click so a double-tap never starts two payments, and a "Pay" button that disables while a request is pending.
Gateway-independent: the page renders entirely from `payment-options` + attempt status. It must contain no `if (provider === 'paynow')` logic.
Every gateway-specific detail (phone prompt text, InnBucks code, OTP) arrives as normalized fields from the adapter (`InitiateResult`).

**Tests:** Playwright on the mock and Paynow-test adapters: EcoCash success/cancel/insufficient (test numbers), InnBucks code + QR displayed,
O'mari OTP flow (mock), new-card popup flow (mock card window → postMessage → status + receipt, popup-blocked fallback), saved-card payment fully on our page via token (mock), token never returned to the browser or logged (asserted), double-click starts one attempt, mobile 375 px screenshots,
axe clean.

## 4. Paynow adapter (launch gateway). Facts verified on developers.paynow.co.zw, Nov 2026

Re-check before coding: https://developers.paynow.co.zw/docs/paynow/quickstart/ (pages: initiate_transaction, express_checkout_transactions,
status_update, generating_hash, validating_hash, test_mode, polling). The official Node SDK (`paynow` on npm) is a reference, but **write the
adapter with `fetch` + WebCrypto** (Workers-compatible). Don't depend on the SDK unless it's verified to run on workerd.

| Item | Value |
|---|---|
| Credentials | **Integration ID** + **Integration Key** (Paynow → Other Ways To Get Paid → Create/Manage Shopping Carts → Create Advanced Integration; the key is emailed to the company address. Generate a new key when going live). Possibly one integration per currency (verify, and model as separate accounts) |
| Redirect initiate | `POST https://www.paynow.co.zw/interface/initiatetransaction`, `Content-Type: application/x-www-form-urlencoded` |
| Express checkout | `POST https://www.paynow.co.zw/interface/remotetransaction`: same fields **plus** `method` (`ecocash`, `onemoney`, `innbucks`, `omari`, `vmc`, `zimswitch`), `phone` (mobile money), `token` + `merchanttrace` (cards, tokenized only). `authemail` **required** for express |
| Request fields (in this order) | `id`, `reference`, `amount` (2 dp, no symbol), `additionalinfo`, `returnurl`, `resulturl`, optional `authemail`, `authphone`, `authname`, `tokenize`, `merchanttrace`, then `status=Message`, then `hash` |
| Response | URL-encoded `status=Ok&browserurl=…&pollurl=…&hash=…` (express adds e.g. InnBucks `authorizationcode`, `authorizationexpires`; O'mari `otpreference`, `remoteotpurl`). Error: `status=Error&error=…` (no hash). **Verify the hash before redirecting** |
| Hash (outbound & inbound) | Concatenate the **values** of all fields except `hash`, in message order (URL-decoded for inbound), append the Integration Key, UTF-8, **SHA-512**, **uppercase hex**. WebCrypto `crypto.subtle.digest('SHA-512')`. Compare in constant time. **Unit-test with the docs' vector:** key `3e9fed89-60e1-4ce5-ab6e-6b1eb2d4f977`, values `1201`,`TEST REF`,`99.99`,`A test ticket transaction`,`http://www.google.com/search?q=returnurl`,`http://www.google.com/search?q=resulturl`,`Message` → `2A033FC38798D913D42ECB786B9B19645ADEDBDE788862032F1BD82CF3B92DEF84F316385D5B40DBB35F1A4FD7D5BFE73835174136463CDD48C9366B0749C689` |
| Status update (callback) | POST to `resulturl`: `reference`, `amount`, `paynowreference`, `pollurl`, `status`, `hash` (+ optional `token`, `tokenexpiry`, `paymentchannel`, masked `paymentinstrument` …). Validate the hash, then **poll `pollurl` to confirm** (also hash-validated). Resent up to 10× on HTTP error |
| Polling | **Empty HTTP POST** to the stored `pollurl` (verified, page `polling_status`). The response has the same fields as the status update, with a hash. Without a poll URL (timeout during initiate): `POST /interface/trace` with `id`, `merchanttrace`, `status=Message`, `hash` → a status update, or `status=NotFound` (hashed). We send `merchanttrace` = attempt id on every express request |
| Statuses → normalized | `Paid`, `Awaiting Delivery`, `Delivered` → **succeeded** (all mean "paid"; funds may sit in suspense) · `Created`, `Sent` → pending · `Cancelled` → cancelled · `Failed` → failed · `Disputed` → disputed · `Refunded` → refunded · unknown → pending + alert (never paid) |
| Test mode | New integrations start in test mode. Only the **merchant account that created the integration** can fake-pay. Set `authemail` to that merchant login email (`options.testAuthEmail`). Express test numbers: **0771111111** success (5 s), **0772222222** delayed success (30 s), **0773333333** user cancelled → failed (30 s), **0774444444** insufficient balance (immediate error). Card tokens `{11111111-…}` success / `{22222222-…}` pending / `{33333333-…}` cancelled / `{44444444-…}` insufficient. Go live via "Request to be Set Live" after ≥ 1 successful test |
| Refunds | No refund API documented → `capabilities.refunds = false` |
| Tokenization | `tokenize=true` needs Paynow approval (email Paynow support). Until approved: `capabilities.tokenization = false` (cards still work via the popup, see §3b). When approved: saved cards + auto-charge |

Method list for the launch account: EcoCash, OneMoney, InnBucks (express), plus "Pay on Paynow page" (redirect: cards, Zimswitch, others).
Add O'mari express (OTP step) behind the `omari` method flag. Build it, and enable it when the merchant account supports it.

**Secrets (Worker):** `PAYNOW_USD_INTEGRATION_ID`, `PAYNOW_USD_INTEGRATION_KEY` (and `PAYNOW_ZWG_*` if a ZWG integration exists).

---

## 5. PesePay adapter (alternative gateway, fully built, not routed at launch). Facts verified Nov 2026

Re-check https://developers.pesepay.com/llms-full.txt before changes.
| Item | Value |
|---|---|
| Base URLs | Live `https://api.pesepay.com/api/payments-engine/v1` · Test `https://api.test.sandbox.pesepay.com/payments-engine/v1` |
| Endpoints | `POST /payments/initiate` (redirect) · `GET /payments/check-payment?referenceNumber=…` · `GET /currencies/active` · `GET /payment-methods/for-currency?currencyCode=…` |
| Headers / envelope | `authorization: <integration key>`, `content-type: application/json`. Bodies `{ "payload": "<base64>" }`, error responses not encrypted |
| Encryption | AES-256-CBC, key = 32-char encryption key (UTF-8), **IV = first 16 chars of that key**, PKCS#7, base64. WebCrypto `AES-CBC` |
| Initiate fields | `amountDetails{amount,currencyCode}`, `reasonForPayment`, `resultUrl`, `returnUrl`, opt. `merchantReference`, `paymentMethodCode`. Response: `referenceNumber`, `redirectUrl`, `pollUrl` |
| Callback | Plain JSON with `referenceNumber`, unsigned, **never retried**, fires only on terminal statuses (not for `PARTIALLY_PAID`). `Authorization` header = integration key (cheap filter only; occasionally missing, so reconciliation must catch those). Always confirm via check-payment. Errors are plain JSON `{message, status}`; success bodies are encrypted |
| Statuses | `SUCCESS` → succeeded (only paid state) · `INITIATED`/`PROCESSING`/`PENDING` → pending · `PARTIALLY_PAID` → partially_paid · `FAILED`/`DECLINED`/`INSUFFICIENT_FUNDS`/`AUTHORIZATION_FAILED`/`ERROR`/`SERVICE_UNAVAILABLE` → failed · `CANCELLED`/`TERMINATED` → cancelled · `TIME_OUT`/`CLOSED`/`CLOSED_PERIOD_ELAPSED` → expired · `REVERSED` → reversed |
| Currencies | `USD` and Zimbabwe dollars, which PesePay addresses as **`ZiG` for EcoCash/PayGo and the hosted page, `ZWG` for O'mari/Zimswitch** (re-verified Nov 2026); we call both `ZWG`. Method codes (USD/ZWG): EcoCash `PZW211`/`PZW201`, InnBucks `PZW212`/—, O'mari `PZW216`/`PZW217`, Zimswitch `PZW215`/`PZW213`, Visa `PZW204`, Mastercard `PZW205`. Sandbox: USD only (EcoCash 0777777777 success / 0770000000 fail). Refund API: none |
| Secrets | `PESEPAY_MAIN_INTEGRATION_KEY`, `PESEPAY_MAIN_ENCRYPTION_KEY` |

It must pass the same conformance kit and integration tests as Paynow (with mocked HTTP), plus the opt-in live test suite when its test keys exist.

## 6. Mock provider (dev/test only)
Hosted page `/dev/mock-checkout/:ref` (Succeed / Fail / Cancel / Partial / Timeout / Dispute) and an express simulation. State in
`mock_provider_state`. The router never selects it when `APP_ENV=production`, and `/dev/*` returns 404 there. "TEST PAYMENT, no real money"
banner on every surface, "TEST" watermark on receipts. Also shown for any account in `mode=test` (Paynow test mode).

## 7. Redaction & logging
Before storing `payment_events.payload_redacted`: drop `hash`, `token`, integration keys/IDs, `authorization` headers. Mask phone numbers
(keep last 3), emails, `paymentinstrument`. Log the provider, account, attempt ID, normalized and raw status, never credentials.

## 8. Required tests (plus 08-TESTING.md)
- **Package:** conformance kit run against paynow, pesepay and mock adapters. Paynow hash vector (above), inbound hash validation using the docs'
  `validating_hash` example, URL-encoded parsing, status mapping for every value, express responses (InnBucks code, O'mari OTP); PesePay AES
  round-trip + status mapping; money conversions.
- **Orchestration:** router selection (specific beats wildcard, missing credentials skipped, no route → no Pay button); **switching a route from
  Paynow to PesePay changes new attempts only**; in-flight attempts reconcile on their original account; duplicate callbacks ×5 concurrently →
  1 payment; forged Paynow callback (bad hash) → nothing applied; callback says Paid but poll says Created → nothing applied; amount mismatch →
  error + alert; reconciliation applies a missed callback; disputed/refunded/reversed handling; overpayment → credit; cross-client protection.
- **Live test suite** (`npm run test:payments:live`, opt-in, needs test-mode keys, never in default CI): Paynow express with 0771111111 (success),
  0773333333 (cancelled), 0774444444 (insufficient), and a redirect initiate + poll. PesePay test env initiate + check if its keys exist.

## 9. Production readiness gate
Payments aren't "production ready" until: the live test suite passes in Paynow test mode against staging (real result URL reachable), a redirect
payment is completed manually through the Paynow page with "Faked Success", reconciliation is verified, the owner has requested "Set Live" and
received live status, and live credentials are set as Worker secrets. FINAL-REPORT must state exactly which of these are done.
