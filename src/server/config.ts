import { z } from 'zod';
import type { AppEnvName } from './lib/security-headers';

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : undefined));

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),
  PUBLIC_SITE_URL: z.url(),
  PAYMENTS_MOCK_ENABLED: z.enum(['true', 'false']).default('false'),
  EMAIL_FROM: z.string().min(3),
  EMAIL_REPLY_TO: z.string().optional().default(''),
  TURNSTILE_SITE_KEY: z.string().min(1),
  ADMIN_ALERT_EMAIL: z.string().optional().default(''),
  EMAIL_PROVIDER: z.enum(['log', 'resend']).default('log'),
  HMAC_SECRET: optionalSecret,
  DATA_ENCRYPTION_KEY: optionalSecret,
  TURNSTILE_SECRET_KEY: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_WEBHOOK_SECRET: optionalSecret,
});

/** Secrets that must exist outside development. Their absence fails closed. */
export const REQUIRED_SECRETS = ['HMAC_SECRET', 'DATA_ENCRYPTION_KEY', 'TURNSTILE_SECRET_KEY'] as const;
/** Secrets whose absence only disables a feature (reported by name by check-env / deep health). */
export const OPTIONAL_SECRETS = [
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'PAYNOW_USD_INTEGRATION_ID',
  'PAYNOW_USD_INTEGRATION_KEY',
  'PESEPAY_MAIN_INTEGRATION_KEY',
  'PESEPAY_MAIN_ENCRYPTION_KEY',
] as const;

/** Development-only fallbacks so `wrangler dev` works without .dev.vars. Never used in staging/production. */
const DEV_FALLBACK = {
  HMAC_SECRET: 'dev-only-hmac-secret-not-for-production-use-0001',
  DATA_ENCRYPTION_KEY: 'ZGV2LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmctMDAwMDA=',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
};

export interface AppConfig {
  appEnv: AppEnvName;
  isProduction: boolean;
  siteUrl: URL;
  siteOrigin: string;
  /** Cookies get `Secure` + `__Host-` prefix only over https. */
  secureCookies: boolean;
  /** The mock payment provider is never available in production, whatever the flag says. */
  mockPaymentsEnabled: boolean;
  emailFrom: string;
  emailProvider: 'log' | 'resend';
  emailReplyTo: string;
  adminAlertEmail: string;
  turnstileSiteKey: string;
  hmacSecret: string;
  dataEncryptionKey: string;
  turnstileSecretKey: string;
  resendApiKey: string | undefined;
  resendWebhookSecret: string | undefined;
  missingSecrets: string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const cache = new WeakMap<object, AppConfig>();

/** Validates the Worker env (cheap, cached per env object). Throws ConfigError — callers fail closed. */
export function getConfig(env: Env): AppConfig {
  const cached = cache.get(env);
  if (cached) return cached;
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
    throw new ConfigError(`Invalid worker configuration: ${keys}`);
  }
  const e = parsed.data;
  const isDev = e.APP_ENV === 'development';
  const missingRequired = REQUIRED_SECRETS.filter((k) => !e[k]);
  if (!isDev && missingRequired.length) {
    throw new ConfigError(`Missing required secrets: ${missingRequired.join(', ')}`);
  }
  const rawEnv = env as unknown as Record<string, unknown>;
  const missingSecrets = [
    ...missingRequired,
    ...OPTIONAL_SECRETS.filter((k) => typeof rawEnv[k] !== 'string' || rawEnv[k] === ''),
  ];
  const siteUrl = new URL(e.PUBLIC_SITE_URL);
  const config: AppConfig = {
    appEnv: e.APP_ENV,
    isProduction: e.APP_ENV === 'production',
    siteUrl,
    siteOrigin: siteUrl.origin,
    secureCookies: siteUrl.protocol === 'https:',
    mockPaymentsEnabled: e.APP_ENV !== 'production' && e.PAYMENTS_MOCK_ENABLED === 'true',
    emailFrom: e.EMAIL_FROM,
    emailProvider: e.EMAIL_PROVIDER,
    emailReplyTo: e.EMAIL_REPLY_TO,
    adminAlertEmail: e.ADMIN_ALERT_EMAIL,
    turnstileSiteKey: e.TURNSTILE_SITE_KEY,
    hmacSecret: e.HMAC_SECRET ?? DEV_FALLBACK.HMAC_SECRET,
    dataEncryptionKey: e.DATA_ENCRYPTION_KEY ?? DEV_FALLBACK.DATA_ENCRYPTION_KEY,
    turnstileSecretKey: e.TURNSTILE_SECRET_KEY ?? DEV_FALLBACK.TURNSTILE_SECRET_KEY,
    resendApiKey: e.RESEND_API_KEY,
    resendWebhookSecret: e.RESEND_WEBHOOK_SECRET,
    missingSecrets,
  };
  cache.set(env, config);
  return config;
}
