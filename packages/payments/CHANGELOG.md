# Changelog — @kuzikode/payments

All notable changes to this package. Versions follow semver; the interface is still settling before 1.0.

## 0.1.0 — 2026-11-11

- `PaymentProvider` interface and types (flows, methods, capabilities, normalized statuses, `credentialFields`).
- Integer-only money helpers (`minorToDecimal`, `decimalToMinor`, `parseDecimalMinor`).
- `ProviderError` with a safe message and a `retryable` flag.
- `redact` (drops secrets, masks phones / e-mails / instruments) and `formToObject`.
- Mock adapter (`createMockProvider`) with an injectable store, test-number express simulation, InnBucks code, O'mari
  OTP, hosted-page outcomes, signed callbacks and refunds.
- Adapter conformance kit (`test/conformance.ts`).
