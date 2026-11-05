/** WebCrypto helpers (Workers + Node 18+). Never log inputs or outputs of these functions. */

const enc = new TextEncoder();

/** Byte arrays backed by a plain ArrayBuffer (what WebCrypto accepts). */
export type Bytes = Uint8Array<ArrayBuffer>;
const utf8 = (s: string): Bytes => enc.encode(s) as Bytes;

export function bytesToBase64(bytes: Bytes): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Bytes {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64Url(bytes: Bytes): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(s: string): Bytes {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

export function bytesToHex(bytes: Bytes): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomBytes(n: number): Bytes {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** Constant-time comparison (length differences return false without early exit on content). */
export function timingSafeEqual(a: Bytes, b: Bytes): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  return timingSafeEqual(utf8(a), utf8(b));
}

export async function sha256Hex(input: string | Bytes): Promise<string> {
  const data = typeof input === 'string' ? utf8(input) : input;
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}

export async function sha256Bytes(input: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
}

export async function hmacSha256(secret: string, message: string): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8(message)));
}

export async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  return bytesToBase64Url(await hmacSha256(secret, message));
}

/** Hash of a client IP with the HMAC pepper, so IPs are never stored in clear. */
export async function hashIp(ip: string, pepper: string): Promise<string> {
  return (await hmacSha256Base64Url(pepper, `ip:${ip}`)).slice(0, 32);
}

// ---------------------------------------------------------------- passwords (docs/07 §1)

export const PBKDF2_ITERATIONS = 100_000; // Workers' maximum for PBKDF2
const PBKDF2_PREFIX = 'pbkdf2_sha256';

async function pbkdf2(password: string, salt: Bytes, iterations: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', utf8(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, iterations);
  return `${PBKDF2_PREFIX}$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export interface PasswordCheck {
  valid: boolean;
  /** True when the stored hash uses weaker parameters than current ones (rehash on successful login). */
  needsRehash: boolean;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<PasswordCheck> {
  const parts = (stored ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== PBKDF2_PREFIX) {
    // Burn comparable CPU so unknown users and malformed hashes are not distinguishable by timing.
    await pbkdf2(password, randomBytes(16), PBKDF2_ITERATIONS);
    return { valid: false, needsRehash: false };
  }
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) {
    return { valid: false, needsRehash: false };
  }
  const actual = await pbkdf2(password, base64ToBytes(parts[2]!), iterations);
  const valid = timingSafeEqual(actual, base64ToBytes(parts[3]!));
  return { valid, needsRehash: valid && iterations < PBKDF2_ITERATIONS };
}

// ---------------------------------------------------------------- AES-GCM (TOTP secrets, card tokens)

async function aesKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  if (raw.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (base64)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypts with AES-256-GCM. `purpose` is bound as additional data so a ciphertext can't be reused elsewhere. */
export async function encryptString(base64Key: string, plaintext: string, purpose: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8(purpose) },
    await aesKey(base64Key),
    utf8(plaintext),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ct))}`;
}

export async function decryptString(base64Key: string, payload: string, purpose: string): Promise<string> {
  const [v, iv, ct] = payload.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('Unsupported ciphertext format');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(iv), additionalData: utf8(purpose) },
    await aesKey(base64Key),
    base64UrlToBytes(ct),
  );
  return new TextDecoder().decode(pt);
}
