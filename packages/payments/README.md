# @kuzikode/payments

Gateway-independent payment adapters for Cloudflare Workers and Node 18+. The app (orchestration: attempts, payments,
invoices, reconciliation) talks only to the `PaymentProvider` interface; each gateway is one adapter. Switching gateway is
a configuration change in the app, never a code change.

- **Zero app imports.** Everything the adapters need is injected: `fetch`, a clock (`now`), a logger, and the
  per-account `ProviderConfig` (credentials come from the app's secrets, never from a database).
- **Runs anywhere WebCrypto and `fetch` exist**: Workers (workerd), Node 18+, browsers for tests. No dependencies.
- **Interchangeable by proof**: every adapter passes the same conformance kit (`test/conformance.ts`).

| Adapter | Status | Flows |
|---|---|---|
| `mock` | Development and tests only. The app must never route to it in production. | redirect + express |
| `paynow` | Launch gateway (`createPaynowProvider`). Credentials: `integrationId`, `integrationKey`; options: `testAuthEmail`, `tokenizationEnabled` | redirect (card entry) + express |
| `pesepay` | Alternative (planned for the next release) | redirect |

## Usage

```ts
import { createMockProvider, memoryMockStore, type ProviderConfig } from '@kuzikode/payments';

const provider = createMockProvider({ store: memoryMockStore() });
const config: ProviderConfig = {
  accountId: 'acc_1',
  mode: 'test',
  credentials: { signingKey: env.MOCK_SIGNING_KEY },
  options: { checkoutBaseUrl: 'https://example.com/dev/mock-checkout' },
};

const started = await provider.initiatePayment(config, {
  merchantReference: 'pat_123', // yours, unique per attempt
  amountMinor: 1234, // always integer minor units
  currency: 'USD',
  description: 'Invoice INV-2026-00001',
  returnUrl: 'https://example.com/pay/return?attempt=pat_123&t=…',
  resultUrl: 'https://example.com/api/payments/callbacks/mock/acc_1',
  flow: 'express',
  methodCode: 'ecocash',
  phone: '0771111111',
});
// started.kind === 'express_pending' → show started.customerInstructions, then poll:
const status = await provider.checkPaymentStatus(config, { pollUrl: started.pollUrl });
```

Rules every caller must follow:

1. **A callback is a claim, not a fact.** `parseCallback` returns `{ authentic, claimed }`. Even when authentic, confirm with
   `checkPaymentStatus` (server to gateway) and apply only that result.
2. **Never treat the browser return as proof of payment.**
3. **Store only `raw`** (already redacted) from results. Never log `ProviderConfig.credentials`.
4. `ProviderError.message` is safe to show; `retryable` says whether a later retry can help.

### Mock adapter

Express test numbers (same as Paynow's test mode): phone ending `1111111` → paid after 5 s, `2222222` → paid after 30 s,
`3333333` → cancelled after 30 s, `4444444` → refused at once (insufficient balance). InnBucks returns a 9-digit code;
O'mari asks for an OTP (`123456` pays). The redirect flow sends the browser to `options.checkoutBaseUrl/<reference>`,
where the host app renders a page that calls `provider.settle(config, reference, outcome)`. Callbacks are JSON signed
with HMAC-SHA256 (`signMockCallback`). State lives in a `MockStore` you provide (`memoryMockStore()` for tests).

## Writing a new adapter

1. Read the gateway's official API docs. Record verified facts (endpoints, signing, statuses, test mode) in the app's
   payments spec before coding. Use `fetch` + WebCrypto only: no SDKs that need Node built-ins.
2. Create `src/providers/<key>.ts` exporting `create<Name>Provider(deps: ProviderDeps): PaymentProvider`:
   - `key` (lower-case), `displayName`, and `credentialFields` (each `{ key, env }`: the app reads the secret
     `<ACCOUNT_PREFIX>_<env>` and passes it as `credentials[key]`).
   - `capabilities(config)`: flows, methods (use the shared method codes: `ecocash`, `onemoney`, `innbucks`, `omari`,
     `card`, …), currencies as the app names them (`USD`, `ZWG`; map to gateway codes inside the adapter), and honest
     flags (`refunds` must be `true` only if `refundPayment` exists).
   - `initiatePayment`: convert amounts with `minorToDecimal`, sign requests as the gateway requires, verify response
     signatures **before** returning a redirect URL, return `raw: redact(response, secretValues)`.
   - `checkPaymentStatus`: map every gateway status to a `NormalizedStatus`. Unknown statuses map to `pending` (never
     `succeeded`) and are logged.
   - `parseCallback`: authenticate (signature, HMAC, header filter) in constant time; return `authentic: false` for
     anything malformed, never throw on bad input.
   - Throw `ProviderError` with a safe message for every failure; mark network and 5xx errors `retryable`.
3. Add `test/<key>.test.ts`: call `describeConformance('<key>', () => harness)` with mocked `fetch` responses, plus tests
   for the gateway's documented signing vectors and every status mapping.
4. Export the factory from `src/index.ts`, add a CHANGELOG entry and bump the minor version.
5. In the app: register the factory, add an account (secret prefix, currencies, methods) and a route. Nothing else changes.

## Extracting to its own repository

The package is built to leave this monorepo without code changes:

```bash
git subtree split --prefix=packages/payments -b payments-lib
git push git@github.com:<owner>/kuzikode-payments.git payments-lib:main
# in the new repo: add a build step (tsc to dist/, "exports" → dist), set "private": false and
# "publishConfig": { "registry": "https://npm.pkg.github.com" }, then publish to GitHub Packages.
```

Then in the app: replace the workspace link with `"@kuzikode/payments": "^0.x"` from GitHub Packages, delete
`packages/payments`, and run the tests. The boundaries test (`test/boundaries.test.ts`) guarantees the package never
imports app code, so this step needs no source changes.

## Tests

`npm test` (here) or `npm run test:unit` (repo root) runs the money, redaction, boundary, mock and conformance tests.
