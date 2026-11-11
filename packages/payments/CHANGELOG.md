# Changelog — @kuzikode/payments

All notable changes to this package. Versions follow semver; the interface is still settling before 1.0.

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
