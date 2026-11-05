/// <reference types="astro/client" />
/* eslint-disable @typescript-eslint/no-empty-object-type -- empty interfaces are required for declaration merging */

/** Worker secrets (`wrangler secret put` / `.dev.vars`). Optional: absence is reported by check-env, never by value. */
interface KuzikodeSecrets {
  HMAC_SECRET?: string;
  DATA_ENCRYPTION_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_WEBHOOK_SECRET?: string;
  PAYNOW_USD_INTEGRATION_ID?: string;
  PAYNOW_USD_INTEGRATION_KEY?: string;
  PAYNOW_TEST_AUTHEMAIL?: string;
  PESEPAY_MAIN_INTEGRATION_KEY?: string;
  PESEPAY_MAIN_ENCRYPTION_KEY?: string;
  /** Present only in the vitest worker: migrations to apply. */
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- ambient file cannot use import statements
  TEST_MIGRATIONS?: import('cloudflare:test').D1Migration[];
}

declare namespace Cloudflare {
  interface Env extends KuzikodeSecrets {}
}
interface Env extends KuzikodeSecrets {}
