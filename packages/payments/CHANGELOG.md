# Changelog — @kuzikode/payments

All notable changes to this package. Versions follow semver; the interface is still settling before 1.0.

## 0.4.0 — 2026-11-11

- Card tokenization (docs/06 §3b): `InitiateInput.tokenize` (redirect card entry returns a reusable token) and
  `InitiateInput.cardToken` (saved-card express payment); `StatusResult.cardToken` (token, expiry, scheme, brand, last 4),
  server-only and never in `raw`. Paynow: `tokenize=true`, `method=vmc|zimswitch` + `token` + `merchanttrace`,
  `tokenexpiry` (D-MMM-YYYY) parsed, re-tokenized token read from every paid status; only when the account option
  `tokenizationEnabled` is set. Mock: same, with Paynow-style test tokens (…44444444 refused, …33333333 cancelled after
  30 s, …22222222 paid after 30 s).

## 0.3.0 — 2026-11-11

- PesePay adapter (`createPesepayProvider`): AES-256-CBC envelope (matches the docs' Node reference byte for byte),
  initiate on PesePay's page with `paymentMethodCode` preselection (EcoCash, InnBucks, O'mari; cards choose on the page),
  check-payment, full status table, `ZiG`/`ZWG` handled per method, unsigned callbacks treated as claims (header filter
  only), sandbox base URL in test mode.

## 0.2.0 — 2026-11-11

- Paynow adapter (`createPaynowProvider`): redirect and express checkout (EcoCash, OneMoney, InnBucks code + expiry,
  O'mari OTP), SHA-512 request signing and response/status-update verification (docs' vectors as tests), polling via the
  poll URL or `/interface/trace` with `merchanttrace`, status mapping, poll/OTP URLs pinned to Paynow hosts.
- Conformance kit: a currency in the status result is optional (Paynow reports none).

## 0.1.0 — 2026-11-11

- `PaymentProvider` interface and types (flows, methods, capabilities, normalized statuses, `credentialFields`).
- Integer-only money helpers (`minorToDecimal`, `decimalToMinor`, `parseDecimalMinor`).
- `ProviderError` with a safe message and a `retryable` flag.
- `redact` (drops secrets, masks phones / e-mails / instruments) and `formToObject`.
- Mock adapter (`createMockProvider`) with an injectable store, test-number express simulation, InnBucks code, O'mari
  OTP, hosted-page outcomes, signed callbacks and refunds.
- Adapter conformance kit (`test/conformance.ts`).
