/**
 * Redaction before anything from a gateway is stored or logged (docs/06 §7): secrets are dropped, personal data masked.
 * Works on flat or nested objects; arrays and nested objects are walked.
 */
import type { Redacted } from './types';

/** Keys whose values are removed entirely (compared lower-case, without `_`/`-`). */
const DROP = new Set([
  'hash',
  'token',
  'integrationkey',
  'integrationid',
  'encryptionkey',
  'authorization',
  'signature',
  'signingkey',
  'secret',
  'password',
  'otp',
  'pin',
  'cvv',
  'cardnumber',
  'pan',
]);
const PHONE_KEYS = new Set(['phone', 'authphone', 'msisdn', 'customerphone', 'phonenumber', 'mobile']);
const EMAIL_KEYS = new Set(['email', 'authemail', 'customeremail']);
const MASK_KEYS = new Set(['paymentinstrument', 'authname', 'name', 'customername']);

const norm = (k: string) => k.toLowerCase().replace(/[_-]/g, '');

/** "0771234567" → "*******567" (keeps the last 3 digits). */
export function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, '');
  if (digits.length <= 3) return '***';
  return `${'*'.repeat(digits.length - 3)}${digits.slice(-3)}`;
}

/** "jane@example.com" → "j***@example.com". */
export function maskEmail(v: string): string {
  const at = v.indexOf('@');
  if (at < 1) return '***';
  return `${v[0]}***${v.slice(at)}`;
}

function maskValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value === null || value === undefined ? value : '***';
  if (PHONE_KEYS.has(key)) return maskPhone(value);
  if (EMAIL_KEYS.has(key)) return maskEmail(value);
  return value.length > 4 ? `***${value.slice(-4)}` : '***';
}

function walk(value: unknown, depth: number): unknown {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const n = norm(k);
      if (DROP.has(n) || n.endsWith('token') || n.endsWith('secret') || n.endsWith('key')) continue;
      out[k] = PHONE_KEYS.has(n) || EMAIL_KEYS.has(n) || MASK_KEYS.has(n) ? maskValue(n, v) : walk(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * A copy of `payload` safe to store: secret keys removed, phone/e-mail/instrument masked. `secretValues` are also
 * scrubbed wherever they appear inside strings (e.g. an integration key echoed in a URL).
 */
export function redact(payload: Record<string, unknown>, secretValues: readonly string[] = []): Redacted {
  let out = walk(payload, 0) as Record<string, unknown>;
  const secrets = secretValues.filter((s) => s && s.length >= 4);
  if (secrets.length) {
    let json = JSON.stringify(out);
    for (const s of secrets) json = json.split(JSON.stringify(s).slice(1, -1)).join('[redacted]');
    out = JSON.parse(json) as Record<string, unknown>;
  }
  return out as Redacted;
}

/** Turns a form/URL-encoded body into an object (gateways like Paynow answer `a=1&b=2`). */
export function formToObject(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}
