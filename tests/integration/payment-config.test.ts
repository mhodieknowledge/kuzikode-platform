/** P6.3c gateway configuration: Super Admin only, validated against what each gateway offers, audited, no secrets. */
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { totp } from '../../src/server/lib/totp';
import { api, login, type Session } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const C = (s: Session, path: string, opts: { body?: unknown; method?: string } = {}) =>
  api(`/api/v1/admin/payments/config${path}`, { cookie: s.cookie, csrf: s.csrf, ...opts });
const audits = async (action: string, entityId: string) =>
  (
    await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_logs WHERE action = ? AND entity_id = ?')
      .bind(action, entityId)
      .first<{ n: number }>()
  )?.n ?? 0;

/** Super Administrators must have 2FA before anything else works. */
async function superAdmin(): Promise<Session> {
  const sup = await createStaff(['super_admin']);
  const s = await login('admin', sup.email, sup.password);
  const start = await api('/api/v1/auth/admin/mfa/enrol', { cookie: s.cookie, csrf: s.csrf, body: {} });
  const code = await totp(start.body.data.secret as string, Date.now());
  expect(
    (await api('/api/v1/auth/admin/mfa/enrol/confirm', { cookie: s.cookie, csrf: s.csrf, body: { code } })).status,
  ).toBe(200);
  return s;
}

describe('payment gateway configuration (P6.3c)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });

  it('only a Super Administrator may read or change it', async () => {
    const admin = await createStaff(['admin']);
    const s = await login('admin', admin.email, admin.password);
    expect((await C(s, '')).status).toBe(403);
    expect((await C(s, '/routes', { body: {} })).status).toBe(403);
    const finance = await createStaff(['finance']);
    expect((await C(await login('admin', finance.email, finance.password), '')).status).toBe(403);
  });

  it('lists accounts with secret names found/missing (never values) and the routes', async () => {
    const s = await superAdmin();
    const res = await C(s, '');
    expect(res.status).toBe(200);
    const paynow = res.body.data.accounts.find((a: { id: string }) => a.id === 'ppa_paynow_usd');
    expect(paynow).toMatchObject({
      providerName: 'Paynow',
      usable: true,
      credentials: {
        complete: false,
        fields: [
          { name: 'PAYNOW_USD_INTEGRATION_ID', present: false },
          { name: 'PAYNOW_USD_INTEGRATION_KEY', present: false },
        ],
      },
    });
    expect(paynow.available.methods.map((m: { code: string }) => m.code)).toContain('innbucks');
    expect(res.body.data.routes.some((r: { id: string }) => r.id === 'prt_platform_usd_paynow')).toBe(true);
    expect(res.body.data.providers.map((p: { key: string }) => p.key)).toEqual(
      expect.arrayContaining(['paynow', 'pesepay', 'mock']),
    );
  });

  it('accounts: create and edit, validated against the gateway, audited', async () => {
    const s = await superAdmin();
    const base = {
      label: 'Paynow ZWG',
      mode: 'test',
      currencies: ['USD'],
      enabledMethods: ['ecocash'],
      enabled: true,
      statusNote: null,
    };
    const created = await C(s, '/accounts', { body: { ...base, providerKey: 'paynow', secretPrefix: 'PAYNOW_ZWG' } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id as string;
    expect(await audits('payment_account.created', id)).toBe(1);
    expect(
      (await C(s, '/accounts', { body: { ...base, providerKey: 'paynow', secretPrefix: 'PAYNOW_ZWG' } })).body.error
        .fields.secretPrefix,
    ).toBeTruthy();
    expect(
      (await C(s, '/accounts', { body: { ...base, providerKey: 'stripe', secretPrefix: 'STRIPE_X' } })).status,
    ).toBe(422);
    expect(
      (await C(s, '/accounts', { body: { ...base, providerKey: 'paynow', secretPrefix: 'bad prefix' } })).status,
    ).toBe(422);

    const bad = await C(s, `/accounts/${id}`, { method: 'PATCH', body: { ...base, enabledMethods: ['bitcoin'] } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.enabledMethods[0]).toContain('bitcoin');
    expect((await C(s, `/accounts/${id}`, { method: 'PATCH', body: { ...base, currencies: ['EUR'] } })).status).toBe(
      422,
    );
    const ok = await C(s, `/accounts/${id}`, {
      method: 'PATCH',
      body: { ...base, mode: 'live', enabled: false, statusNote: 'Waiting for Paynow to set it live.' },
    });
    expect(ok.status).toBe(200);
    const row = await env.DB.prepare('SELECT mode, enabled, status_note FROM payment_provider_accounts WHERE id = ?')
      .bind(id)
      .first();
    expect(row).toEqual({ mode: 'live', enabled: 0, status_note: 'Waiting for Paynow to set it live.' });
    expect(await audits('payment_account.updated', id)).toBe(1);
  });

  it('routes: add, edit, remove; a method the account does not offer is refused', async () => {
    const s = await superAdmin();
    const body = {
      appKey: 'kuzikode-platform',
      currency: 'USD',
      methodCode: 'innbucks',
      accountId: 'ppa_mock',
      priority: 50,
      enabled: true,
    };
    const created = await C(s, '/routes', { body });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id as string;
    // The seeded PesePay account offers no "onemoney".
    expect(
      (await C(s, '/routes', { body: { ...body, methodCode: 'onemoney', accountId: 'ppa_pesepay_main' } })).status,
    ).toBe(422);
    expect((await C(s, '/routes', { body: { ...body, accountId: 'ppa_nope' } })).status).toBe(422);
    expect(
      (await C(s, `/routes/${id}`, { method: 'PATCH', body: { ...body, priority: 70, enabled: false } })).status,
    ).toBe(200);
    expect(await env.DB.prepare('SELECT priority, enabled FROM payment_routes WHERE id = ?').bind(id).first()).toEqual({
      priority: 70,
      enabled: 0,
    });
    expect((await C(s, `/routes/${id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await C(s, `/routes/${id}`, { method: 'DELETE' })).status).toBe(404);
    for (const action of ['payment_route.created', 'payment_route.updated', 'payment_route.deleted'])
      expect(await audits(action, id)).toBe(1);
  });
});
