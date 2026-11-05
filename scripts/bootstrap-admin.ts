/**
 * One-time creation of the first Super Administrator (docs/07 §9).
 *   npm run bootstrap:admin -- --env local|staging|production --email owner@example.com --name "Owner" [--reissue]
 * - Refuses if an active super admin already exists.
 * - Creates the user with no usable password (status 'invited'), the super_admin role, a system audit row and a
 *   single-use invite token valid for 24 h, then prints the set-password link to this terminal only.
 * - --reissue creates a fresh link for the invited super admin while no active super admin exists.
 * Never run in CI. Never commit or log the printed link.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sq } from './seeds/build-base-seed.ts';

export type BootstrapEnv = 'local' | 'staging' | 'production';

export interface BootstrapArgs {
  env: BootstrapEnv;
  email: string;
  name: string;
  reissue: boolean;
  persistTo?: string;
  siteUrl?: string;
}

export function parseArgs(argv: string[]): BootstrapArgs {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const env = get('--env');
  if (env !== 'local' && env !== 'staging' && env !== 'production')
    throw new Error('--env must be local, staging or production');
  const email = (get('--email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)
    throw new Error('--email must be a valid email address');
  const name = (get('--name') ?? '').trim();
  if (!name || name.length > 120) throw new Error('--name is required (max 120 characters)');
  const persistTo = get('--persist-to');
  const siteUrl = get('--site-url');
  return {
    env,
    email,
    name,
    reissue: argv.includes('--reissue'),
    ...(persistTo ? { persistTo } : {}),
    ...(siteUrl ? { siteUrl } : {}),
  };
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newId(prefix: string, now = Date.now()): string {
  let t = now;
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return `${prefix}_${time}${[...randomBytes(16)].map((b) => CROCKFORD[b & 31]).join('')}`;
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

export const ACTIVE_SUPER_ADMINS_SQL = `SELECT count(*) AS n FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_id = 'rol_super_admin' AND u.status = 'active'`;

export function buildCreateSql(p: {
  userId: string;
  email: string;
  name: string;
  tokenId: string;
  tokenHash: string;
  now: Date;
}): string {
  const now = p.now.toISOString();
  const expires = new Date(p.now.getTime() + 24 * 3600_000).toISOString();
  return [
    `INSERT INTO users (id, email, name, user_type, status, must_change_password, created_at, updated_at) VALUES (${sq(p.userId)}, ${sq(p.email)}, ${sq(p.name)}, 'staff', 'invited', 0, ${sq(now)}, ${sq(now)});`,
    `INSERT INTO user_roles (user_id, role_id, granted_at) VALUES (${sq(p.userId)}, 'rol_super_admin', ${sq(now)});`,
    tokenSql(p.tokenId, p.userId, p.email, p.tokenHash, now, expires),
    `INSERT INTO audit_logs (id, actor_type, action, entity_type, entity_id, after, created_at) VALUES (${sq(newId('aud'))}, 'system', 'user.bootstrap_super_admin', 'user', ${sq(p.userId)}, ${sq(JSON.stringify({ email: p.email }))}, ${sq(now)});`,
  ].join('\n');
}

function tokenSql(tokenId: string, userId: string, email: string, hash: string, now: string, expires: string): string {
  return `INSERT INTO auth_tokens (id, user_id, email, purpose, token_hash, expires_at, metadata, created_at) VALUES (${sq(tokenId)}, ${sq(userId)}, ${sq(email)}, 'invite_staff', ${sq(hash)}, ${sq(expires)}, '{"bootstrap":true}', ${sq(now)});`;
}

export function buildReissueSql(p: {
  userId: string;
  email: string;
  tokenId: string;
  tokenHash: string;
  now: Date;
}): string {
  const now = p.now.toISOString();
  const expires = new Date(p.now.getTime() + 24 * 3600_000).toISOString();
  return [
    `UPDATE auth_tokens SET used_at = ${sq(now)} WHERE user_id = ${sq(p.userId)} AND purpose = 'invite_staff' AND used_at IS NULL;`,
    tokenSql(p.tokenId, p.userId, p.email, p.tokenHash, now, expires),
    `INSERT INTO audit_logs (id, actor_type, action, entity_type, entity_id, created_at) VALUES (${sq(newId('aud'))}, 'system', 'user.bootstrap_link_reissued', 'user', ${sq(p.userId)}, ${sq(now)});`,
  ].join('\n');
}

/** PUBLIC_SITE_URL for the env from wrangler.jsonc (comments stripped). */
export function siteUrlFor(env: BootstrapEnv): string {
  const raw = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  const cfg = JSON.parse(raw) as {
    vars: { PUBLIC_SITE_URL: string };
    env: Record<string, { vars: { PUBLIC_SITE_URL: string } }>;
  };
  return env === 'local' ? cfg.vars.PUBLIC_SITE_URL : cfg.env[env]!.vars.PUBLIC_SITE_URL;
}

function d1(args: BootstrapArgs, sqlArgs: string[]): unknown {
  const target =
    args.env === 'local'
      ? ['--local', ...(args.persistTo ? ['--persist-to', args.persistTo] : [])]
      : ['--remote', '--env', args.env];
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', ...target, '--json', '--yes', ...sqlArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function query<T>(args: BootstrapArgs, sql: string): T[] {
  const res = d1(args, ['--command', sql]) as { results: T[] }[];
  return res[0]?.results ?? [];
}

export function run(args: BootstrapArgs): { link: string } {
  const active = query<{ n: number }>(args, ACTIVE_SUPER_ADMINS_SQL)[0]?.n ?? 0;
  if (active > 0) throw new Error('A Super Administrator already exists. Bootstrap is only for the first account.');
  const existing = query<{ id: string; status: string; user_type: string }>(
    args,
    `SELECT id, status, user_type FROM users WHERE email = ${sq(args.email)}`,
  )[0];
  const { token, hash } = newToken();
  const tokenId = newId('tok');
  const now = new Date();
  let sql: string;
  if (args.reissue) {
    if (!existing || existing.status !== 'invited')
      throw new Error('--reissue needs an invited (not yet active) account with that email.');
    sql = buildReissueSql({ userId: existing.id, email: args.email, tokenId, tokenHash: hash, now });
  } else {
    if (existing)
      throw new Error('A user with that email already exists. Use --reissue for an unaccepted bootstrap invite.');
    sql = buildCreateSql({ userId: newId('usr'), email: args.email, name: args.name, tokenId, tokenHash: hash, now });
  }
  d1(args, ['--command', sql]);
  const base = args.siteUrl ?? siteUrlFor(args.env);
  return { link: new URL(`/admin/accept-invite?token=${encodeURIComponent(token)}`, base).toString() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { link } = run(parseArgs(process.argv.slice(2)));
    process.stdout.write(
      `\nFirst Super Administrator created.\nOpen this one-time link within 24 hours to set the password (do not share or commit it):\n\n  ${link}\n\n`,
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
