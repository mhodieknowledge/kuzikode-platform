/// <reference types="astro/client" />
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/consistent-type-imports -- ambient declaration-merging file */

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
  TEST_MIGRATIONS?: import('cloudflare:test').D1Migration[];
}

declare namespace Cloudflare {
  interface Env extends KuzikodeSecrets {}
}
interface Env extends KuzikodeSecrets {}

declare namespace App {
  interface Locals {
    ctx: import('./server/context').RequestContext;
  }
}

declare module '*.sql?raw' {
  const content: string;
  export default content;
}

declare module '*.txt?raw' {
  const content: string;
  export default content;
}

/** Injected by Vite `define` at build time (astro.config.mjs). */
declare const __BUILD_ID__: string | undefined;
