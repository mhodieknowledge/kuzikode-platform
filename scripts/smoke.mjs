/**
 * Post-deploy smoke test (docs/09 §6 and §9). Read-only: GET requests only, no sign-in, no form posts.
 *   node scripts/smoke.mjs https://kuzikode-staging.<subdomain>.workers.dev [--env staging|production]
 * Exits 1 and lists every failed check. Retries 429/5xx for a short while because a fresh deploy can take a
 * few seconds to reach every edge location.
 */
import { fileURLToPath } from 'node:url';

/** @typedef {{ path: string, status: number, type?: RegExp, body?: RegExp, headers?: Record<string, RegExp>, absentHeaders?: string[] }} Check */

/** @param {'staging' | 'production'} env @returns {Check[]} */
export function checksFor(env) {
  const prod = env === 'production';
  const security = {
    'content-security-policy': /frame-ancestors 'none'/,
    'x-content-type-options': /^nosniff$/,
    'referrer-policy': /^strict-origin-when-cross-origin$/,
    'x-frame-options': /^DENY$/,
    ...(prod ? { 'strict-transport-security': /max-age=\d+/ } : {}),
  };
  const priv = { 'cache-control': /no-store/, 'x-robots-tag': /noindex/ };
  const html = /^text\/html/;
  return [
    { path: '/api/health', status: 200, type: /^application\/json/, body: /"status":"ok"/, headers: priv },
    { path: '/', status: 200, type: html, body: /Kuzikode/, headers: security },
    { path: '/services/', status: 200, type: html, body: /Kuzikode/ },
    { path: '/pricing', status: 200, type: html },
    // The Turnstile island gets its site key as a prop; production must use a real key (0x…), never a test key (1x…).
    {
      path: '/contact',
      status: 200,
      type: html,
      body: prod ? /siteKey&quot;:\[0,&quot;0x/ : /siteKey&quot;:\[0,&quot;/,
    },
    { path: '/legal/privacy', status: 200, type: html },
    { path: '/admin/login', status: 200, type: html, headers: { ...security, ...priv } },
    { path: '/portal/login', status: 200, type: html, headers: priv },
    {
      path: '/robots.txt',
      status: 200,
      type: /^text\/plain/,
      body: prod ? /Sitemap: https:\/\// : /Disallow: \/\s*$/m,
    },
    { path: '/sitemap.xml', status: 200, type: /xml/, body: /<urlset/ },
    { path: '/this-page-does-not-exist', status: 404, type: html },
  ];
}

/** @param {Check} check @param {Response} res @param {string} text @returns {string[]} */
export function evaluate(check, res, text) {
  const errors = [];
  if (res.status !== check.status) errors.push(`status ${res.status}, expected ${check.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (check.type && !check.type.test(type)) errors.push(`content-type "${type}"`);
  if (check.body && !check.body.test(text)) errors.push(`body does not match ${check.body}`);
  for (const [name, re] of Object.entries(check.headers ?? {})) {
    const v = res.headers.get(name);
    if (v === null) errors.push(`missing header ${name}`);
    else if (!re.test(v)) errors.push(`header ${name} = "${v}"`);
  }
  return errors;
}

/**
 * @param {string} base
 * @param {{ env: 'staging' | 'production', fetchImpl?: typeof fetch, attempts?: number, delayMs?: number }} opts
 */
export async function smoke(base, opts) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const attempts = opts.attempts ?? 6;
  const delayMs = opts.delayMs ?? 5000;
  const failures = [];
  for (const check of checksFor(opts.env)) {
    const url = new URL(check.path, base).toString();
    let errors = [];
    for (let i = 1; i <= attempts; i++) {
      try {
        const res = await fetchImpl(url, {
          redirect: 'manual',
          headers: { 'user-agent': 'kuzikode-smoke/1' },
          signal: AbortSignal.timeout(15_000),
        });
        const text = await res.text();
        errors = evaluate(check, res, text);
        // Cloudflare's own page when the account's Workers Free plan daily request limit is used up (all Workers).
        if (res.status === 429 && /Error 1027/.test(text))
          errors = ['Cloudflare error 1027: the account has used its Workers daily request limit (resets 00:00 UTC)'];
        if (errors.length === 0 || (res.status !== 429 && res.status < 500)) break;
      } catch (err) {
        errors = [`request failed: ${err instanceof Error ? err.message : String(err)}`];
      }
      if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
    }
    if (errors.length) failures.push({ path: check.path, errors });
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const envIdx = process.argv.indexOf('--env');
  const env = envIdx > 0 ? process.argv[envIdx + 1] : 'staging';
  if (!base || !/^https?:\/\//.test(base) || (env !== 'staging' && env !== 'production')) {
    console.error('Usage: node scripts/smoke.mjs <base-url> [--env staging|production]');
    process.exit(2);
  }
  const failures = await smoke(base, { env });
  for (const f of failures) console.error(`✗ ${f.path}: ${f.errors.join('; ')}`);
  const total = checksFor(env).length;
  console.log(`${total - failures.length}/${total} smoke checks passed against ${base}`);
  process.exit(failures.length ? 1 : 0);
}
