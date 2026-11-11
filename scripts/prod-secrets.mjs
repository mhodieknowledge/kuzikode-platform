/**
 * Prepares the secrets file for a production (or staging) deploy, used by deploy-production.yml:
 *   node scripts/prod-secrets.mjs --env production --out <file>
 * - Reads which Worker secrets already exist (`wrangler secret list`, names only; a Worker that doesn't exist yet has none).
 * - Generates HMAC_SECRET and DATA_ENCRYPTION_KEY only when the Worker doesn't have them yet. It never regenerates an
 *   existing one: a new DATA_ENCRYPTION_KEY would make stored TOTP secrets unreadable (rotation is a RUNBOOK procedure).
 * - Passes through third-party keys that the workflow provides as environment variables (from GitHub secrets),
 *   so updating a GitHub secret and re-running the deploy updates the Worker secret.
 * - Fails before anything is deployed if a required secret would still be missing.
 * Writes JSON for `wrangler deploy --secrets-file` (mode 0600). Prints secret NAMES only, never values.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIRED = ['HMAC_SECRET', 'DATA_ENCRYPTION_KEY', 'TURNSTILE_SECRET_KEY'];
export const PASSTHROUGH = [
  'TURNSTILE_SECRET_KEY',
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'PAYNOW_USD_INTEGRATION_ID',
  'PAYNOW_USD_INTEGRATION_KEY',
  'PAYNOW_ZWG_INTEGRATION_ID',
  'PAYNOW_ZWG_INTEGRATION_KEY',
  'PESEPAY_MAIN_INTEGRATION_KEY',
  'PESEPAY_MAIN_ENCRYPTION_KEY',
];

/** @type {Record<string, () => string>} */
export const GENERATED = {
  HMAC_SECRET: () => randomBytes(48).toString('base64url'),
  DATA_ENCRYPTION_KEY: () => randomBytes(32).toString('base64'),
};

/**
 * @param {string[]} existing names already on the Worker
 * @param {Record<string, string | undefined>} env
 * @returns {{ secrets: Record<string, string>, generated: string[], updated: string[], missing: string[] }}
 */
export function planSecrets(existing, env) {
  const have = new Set(existing);
  /** @type {Record<string, string>} */
  const secrets = {};
  const generated = [];
  const updated = [];
  for (const name of PASSTHROUGH) {
    const v = env[name];
    if (v && v.trim() !== '') {
      secrets[name] = v;
      updated.push(name);
    }
  }
  for (const [name, make] of Object.entries(GENERATED)) {
    if (!have.has(name) && !secrets[name]) {
      secrets[name] = make();
      generated.push(name);
    }
  }
  const missing = REQUIRED.filter((n) => !have.has(n) && !secrets[n]);
  return { secrets, generated, updated, missing };
}

/** @param {string} env @returns {string[]} */
function existingSecretNames(env) {
  try {
    const out = execFileSync('npx', ['wrangler', 'secret', 'list', '--env', env, '--format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const json = out.slice(out.indexOf('['));
    return JSON.parse(json).map((/** @type {{ name: string }} */ s) => s.name);
  } catch (err) {
    const msg = String(/** @type {{ stderr?: string }} */ (err).stderr ?? err);
    if (/not found|does not exist|10007/i.test(msg)) return []; // first deploy: the Worker doesn't exist yet
    throw new Error(`Could not list Worker secrets: ${msg.split('\n').find((l) => l.trim()) ?? 'unknown error'}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (/** @type {string} */ f) => {
    const i = process.argv.indexOf(f);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const env = arg('--env');
  const out = arg('--out');
  if ((env !== 'production' && env !== 'staging') || !out) {
    console.error('Usage: node scripts/prod-secrets.mjs --env production|staging --out <file>');
    process.exit(2);
  }
  try {
    const plan = planSecrets(existingSecretNames(env), process.env);
    if (plan.missing.length) {
      console.error(
        `Missing required secrets for ${env}: ${plan.missing.join(', ')}. Add them as GitHub secrets (docs/PRODUCTION-CHECKLIST.md).`,
      );
      process.exit(1);
    }
    writeFileSync(out, JSON.stringify(plan.secrets), { mode: 0o600 });
    console.log(`Generated: ${plan.generated.join(', ') || 'none'}`);
    console.log(`Updated from GitHub secrets: ${plan.updated.join(', ') || 'none'}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
