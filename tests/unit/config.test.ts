import { describe, expect, it } from 'vitest';
import { ConfigError, getConfig } from '../../src/server/config';

const base = {
  APP_ENV: 'development',
  PUBLIC_SITE_URL: 'http://localhost:8787',
  PAYMENTS_MOCK_ENABLED: 'true',
  EMAIL_FROM: 'Kuzikode <onboarding@resend.dev>',
  EMAIL_REPLY_TO: '',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  ADMIN_ALERT_EMAIL: '',
};
const secrets = { HMAC_SECRET: 'x'.repeat(40), DATA_ENCRYPTION_KEY: 'k', TURNSTILE_SECRET_KEY: 't' };
const cfg = (e: Record<string, unknown>) => getConfig(e as unknown as Env);

describe('getConfig', () => {
  it('accepts a development env without secrets and reports what is missing', () => {
    const c = cfg({ ...base });
    expect(c.appEnv).toBe('development');
    expect(c.secureCookies).toBe(false);
    expect(c.missingSecrets).toContain('HMAC_SECRET');
    expect(c.missingSecrets).toContain('RESEND_API_KEY');
  });

  it('fails closed outside development when required secrets are missing', () => {
    expect(() => cfg({ ...base, APP_ENV: 'staging', PUBLIC_SITE_URL: 'https://s.example.com' })).toThrow(ConfigError);
  });

  it('never enables the mock provider in production', () => {
    const c = cfg({ ...base, ...secrets, APP_ENV: 'production', PUBLIC_SITE_URL: 'https://kuzikode.com' });
    expect(c.mockPaymentsEnabled).toBe(false);
    expect(c.secureCookies).toBe(true);
    expect(c.siteOrigin).toBe('https://kuzikode.com');
  });

  it('rejects an invalid site URL or env name', () => {
    expect(() => cfg({ ...base, PUBLIC_SITE_URL: 'not a url' })).toThrow(/PUBLIC_SITE_URL/);
    expect(() => cfg({ ...base, APP_ENV: 'prod' })).toThrow(/APP_ENV/);
  });
});
