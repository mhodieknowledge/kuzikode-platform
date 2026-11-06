import { env } from 'cloudflare:workers';
import { hashPassword } from '../../src/server/lib/crypto';
import { newId } from '../../src/server/lib/ids';
import { seedBase } from './seed';

export const DEFAULT_PASSWORD = 'correct horse battery staple';
let seeded = false;
let hashCache: Promise<string> | undefined;

async function ensureSeed() {
  if (!seeded) {
    await seedBase();
    seeded = true;
  }
}

/** One PBKDF2 hash of the default password reused by all factories (keeps tests fast). */
function defaultHash(): Promise<string> {
  hashCache ??= hashPassword(DEFAULT_PASSWORD);
  return hashCache;
}

const unique = () => Math.random().toString(36).slice(2, 10);

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createStaff(
  roles: string[] = ['admin'],
  opts: { email?: string; password?: string; status?: string; mustChange?: boolean } = {},
): Promise<TestUser> {
  await ensureSeed();
  const id = newId('usr');
  const email = opts.email ?? `staff-${unique()}@example.com`;
  const password = opts.password ?? DEFAULT_PASSWORD;
  const hash = opts.password ? await hashPassword(opts.password) : await defaultHash();
  const stmts = [
    env.DB.prepare(
      "INSERT INTO users (id, email, name, user_type, password_hash, status, must_change_password, email_verified_at) VALUES (?, ?, ?, 'staff', ?, ?, ?, ?)",
    ).bind(id, email, 'Test Staff', hash, opts.status ?? 'active', opts.mustChange ? 1 : 0, new Date().toISOString()),
    ...roles.map((r) =>
      env.DB.prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE key = ?').bind(id, r),
    ),
  ];
  await env.DB.batch(stmts);
  return { id, email, password };
}

export async function createClient(name = 'Example Client (Pvt) Ltd'): Promise<{ id: string }> {
  await ensureSeed();
  const id = newId('cli');
  await env.DB.prepare(
    "INSERT INTO clients (id, client_number, type, display_name, default_currency, email) VALUES (?, ?, 'business', ?, 'USD', ?)",
  )
    .bind(id, `CL-T${unique()}`, name, `${unique()}@example.com`)
    .run();
  return { id };
}

export async function createPortalUser(
  clientIds: string[],
  opts: { email?: string; status?: string; role?: 'owner' | 'member' | 'billing' } = {},
): Promise<TestUser> {
  await ensureSeed();
  const id = newId('usr');
  const email = opts.email ?? `client-${unique()}@example.com`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO users (id, email, name, user_type, password_hash, status, email_verified_at) VALUES (?, ?, 'Test Client', 'client', ?, ?, ?)",
    ).bind(id, email, await defaultHash(), opts.status ?? 'active', new Date().toISOString()),
    ...clientIds.map((cid) =>
      env.DB.prepare(
        "INSERT INTO client_user_access (id, client_id, user_id, role, status) VALUES (?, ?, ?, ?, 'active')",
      ).bind(newId('cua'), cid, id, opts.role ?? 'owner'),
    ),
  ]);
  return { id, email, password: DEFAULT_PASSWORD };
}
