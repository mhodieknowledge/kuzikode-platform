import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { AppError } from '../../src/server/lib/errors';
import { resolveSession } from '../../src/server/modules/auth';
import { contentVersion, resetCmsCache } from '../../src/server/modules/cms';
import {
  createTaxRate,
  integrations,
  listCurrencies,
  listTaxRates,
  notificationPreferences,
  numbering,
  setNotificationPreferences,
  updateCurrency,
  updateNumbering,
  updatePaymentAccount,
  updateSection,
  updateTaxRate,
} from '../../src/server/modules/settings';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';

async function ctxFor(roles: string[]) {
  const u = await createStaff(roles);
  const s = await login('admin', u.email, u.password);
  const ctx = createContext({ env });
  ctx.auth = await resolveSession(ctx, s.cookie, 'admin');
  ctx.actor = { type: 'staff', userId: ctx.auth!.user.id };
  return { ctx, session: s, user: u };
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'OK';
  } catch (e) {
    return e instanceof AppError ? `${e.code}${e.fields ? `:${Object.keys(e.fields).join(',')}` : ''}` : String(e);
  }
};
const setting = async (key: string) =>
  JSON.parse(
    (await env.DB.prepare('SELECT value FROM application_settings WHERE key = ?').bind(key).first<{ value: string }>())!
      .value,
  );

describe('settings (P4.3)', () => {
  it('saves only changed keys, audits before/after and bumps content_version; rejects bad values', async () => {
    const { ctx } = await ctxFor(['admin']);
    resetCmsCache();
    const v0 = await contentVersion(ctx);
    const changed = await updateSection(ctx, 'contact', {
      'contact.phone': '+263 77 123 4567',
      'contact.location': 'Zimbabwe',
    });
    expect(changed).toEqual(['contact.phone']);
    expect(await setting('contact.phone')).toBe('+263 77 123 4567');
    resetCmsCache();
    expect(await contentVersion(ctx)).toBe(v0 + 1);
    const audit = await env.DB.prepare(
      "SELECT before, after FROM audit_logs WHERE action = 'settings.updated' AND entity_id = 'contact' ORDER BY created_at DESC",
    ).first<any>();
    // Phone numbers are masked in the audit log (PII redaction).
    expect(JSON.parse(audit.after)).toEqual({ 'contact.phone': '***567' });
    expect(await updateSection(ctx, 'contact', { 'contact.phone': '+263 77 123 4567' })).toEqual([]);

    expect(await code(updateSection(ctx, 'social', { 'social.linkedin': 'http://insecure.example' }))).toBe(
      'VALIDATION_FAILED:social.linkedin',
    );
    expect(await code(updateSection(ctx, 'contact', { 'company.name': 'Sneaky' }))).toBe('VALIDATION_FAILED:_');
    expect(await code(updateSection(ctx, 'invoicing', { 'invoice.default_terms_days': 500 }))).toBe(
      'VALIDATION_FAILED:invoice.default_terms_days',
    );
    expect(await code(updateSection(ctx, 'nope', {}))).toBe('NOT_FOUND');
    await updateSection(ctx, 'contact', { 'contact.phone': '' });
  });

  it('only users with settings.manage can save; settings.view is not enough', async () => {
    const { session } = await ctxFor(['finance_manager']);
    const res = await api('/api/v1/admin/settings/sections/company', {
      method: 'PUT',
      cookie: session.cookie,
      csrf: session.csrf,
      body: { 'company.tagline': 'x' },
    });
    expect([401, 403]).toContain(res.status);
  });

  it('numbering: super admin only; the next number can be raised but never lowered, and a refused change writes nothing', async () => {
    const admin = await ctxFor(['admin']);
    expect(await code(updateNumbering(admin.ctx, 'invoice', { format: 'INV-{YYYY}-{SEQ:5}', nextValue: 10 }))).toBe(
      'FORBIDDEN',
    );
    const { ctx } = await ctxFor(['super_admin']);
    const before = (await numbering(ctx)).find((r) => r.kind === 'quotation')!;
    await updateNumbering(ctx, 'quotation', { format: before.format, nextValue: before.nextValue + 50 });
    const raised = (await numbering(ctx)).find((r) => r.kind === 'quotation')!;
    expect(raised.nextValue).toBe(before.nextValue + 50);
    expect(raised.example).toContain(String(before.nextValue + 50));

    const audits = async () =>
      (await env.DB.prepare(
        "SELECT COUNT(*) n FROM audit_logs WHERE action = 'numbering.updated' AND entity_id = 'quotation'",
      ).first<{ n: number }>())!.n;
    const n = await audits();
    // A yearly format shares this year's sequence, so it can't be set below the current number.
    expect(await code(updateNumbering(ctx, 'quotation', { format: 'Q-{SEQ:3}-{YY}', nextValue: 1 }))).toBe(
      'VALIDATION_FAILED:nextValue',
    );
    expect(await setting('numbering.quotation')).toBe(before.format);
    // A non-yearly format uses its own sequence, which starts at 1.
    expect(await code(updateNumbering(ctx, 'quotation', { format: 'Q-{SEQ:3}', nextValue: 1 }))).toBe('OK');
    expect(await setting('numbering.quotation')).toBe('Q-{SEQ:3}');
    expect(await code(updateNumbering(ctx, 'quotation', { format: before.format, nextValue: 2 }))).toBe(
      'VALIDATION_FAILED:nextValue',
    );
    expect(await setting('numbering.quotation')).toBe('Q-{SEQ:3}');
    expect(await audits()).toBe(n + 1);
    expect(await code(updateNumbering(ctx, 'quotation', { format: 'NO-SEQ', nextValue: 1 }))).toBe(
      'VALIDATION_FAILED:format',
    );
    expect(await code(updateNumbering(ctx, 'quotation', { format: '<b>{SEQ}</b>', nextValue: 5 }))).toBe(
      'VALIDATION_FAILED:format',
    );
    await updateNumbering(ctx, 'quotation', { format: before.format, nextValue: before.nextValue + 50 });
  });

  it('currencies: one default that must stay active; tax rates keep their percentage', async () => {
    const { ctx } = await ctxFor(['admin']);
    expect(await code(updateCurrency(ctx, 'USD', { active: false, isDefault: true }))).toBe('VALIDATION_FAILED:active');
    expect(await code(updateCurrency(ctx, 'USD', { active: true, isDefault: false }))).toBe('CONFLICT');
    await updateCurrency(ctx, 'ZWG', { active: true, isDefault: true });
    expect((await listCurrencies(ctx)).filter((c) => c.isDefault).map((c) => c.code)).toEqual(['ZWG']);
    expect(await setting('currency.default')).toBe('ZWG');
    await updateCurrency(ctx, 'USD', { active: true, isDefault: true });
    expect(await setting('currency.default')).toBe('USD');

    const vat = (await listTaxRates(ctx)).find((t) => t.id === 'tax_vat')!;
    expect(vat).toMatchObject({ rateBp: 1550, active: false });
    const { id } = await createTaxRate(ctx, { name: 'Test levy 2%', rateBp: 200, inclusive: false });
    await updateTaxRate(ctx, id, { name: 'Test levy', active: true, isDefault: true });
    const rates = await listTaxRates(ctx);
    expect(rates.find((t) => t.id === id)).toMatchObject({
      name: 'Test levy',
      rateBp: 200,
      active: true,
      isDefault: true,
    });
    expect(await code(updateTaxRate(ctx, id, { name: 'Test levy', active: false, isDefault: true }))).toBe(
      'VALIDATION_FAILED:active',
    );
    await updateTaxRate(ctx, id, { name: 'Test levy', active: false, isDefault: false });
  });

  it('integrations report configured/not configured without exposing secrets; live mode needs secrets', async () => {
    const { ctx } = await ctxFor(['super_admin']);
    const info = await integrations(ctx);
    const paynow = info.payments.find((p) => p.id === 'ppa_paynow_usd')!;
    expect(typeof paynow.secretsConfigured).toBe('boolean');
    expect(JSON.stringify(info)).not.toMatch(/INTEGRATION_KEY|secret_prefix/);
    if (!paynow.secretsConfigured) {
      expect(
        await code(updatePaymentAccount(ctx, 'ppa_paynow_usd', { label: 'Paynow USD', enabled: true, mode: 'live' })),
      ).toBe('VALIDATION_FAILED:mode');
    }
    await updatePaymentAccount(ctx, 'ppa_paynow_usd', { label: 'Paynow (USD)', enabled: true, mode: 'test' });
    expect((await integrations(ctx)).payments.find((p) => p.id === 'ppa_paynow_usd')!.label).toBe('Paynow (USD)');
    const admin = await ctxFor(['admin']);
    expect(
      await code(updatePaymentAccount(admin.ctx, 'ppa_paynow_usd', { label: 'X', enabled: false, mode: 'test' })),
    ).toBe('FORBIDDEN');
  });

  it('test email is queued to the signed-in user; notification preferences are personal', async () => {
    const { session, user, ctx } = await ctxFor(['admin']);
    const res = await api('/api/v1/admin/settings/email/test', {
      cookie: session.cookie,
      csrf: session.csrf,
      body: {},
    });
    expect(res.body.data.to).toBe(user.email);
    const job = await env.DB.prepare(
      "SELECT COUNT(*) n FROM outbox WHERE json_extract(payload,'$.template') = 'system_test' AND json_extract(payload,'$.to') = ?",
    )
      .bind(user.email)
      .first<{ n: number }>();
    expect(job!.n).toBe(1);

    await setNotificationPreferences(ctx, [{ type: 'enquiry.new', inApp: true, email: false }]);
    const prefs = await notificationPreferences(ctx);
    expect(prefs.find((p) => p.type === 'enquiry.new')).toMatchObject({ inApp: true, email: false });
    expect(prefs.find((p) => p.type === 'payment.received')).toMatchObject({ inApp: true, email: true });
    expect(await code(setNotificationPreferences(ctx, [{ type: 'made.up', inApp: true, email: true }]))).toBe(
      'VALIDATION_FAILED:prefs',
    );
  });
});
