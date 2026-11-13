import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { bumpContentVersionStmt, resetCmsCache } from '../../src/server/modules/cms';
import { ORIGIN } from '../helpers/api';
import { exe, pdf } from '../helpers/file-fixtures';
import { createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const valid = (over: Record<string, unknown> = {}) => ({
  category: 'websites',
  service: 'business-website',
  package: 'business-website',
  addons: ['pad_logo_design', 'pad_copywriting'],
  features: ['online_payments', 'blog'],
  budgetRange: '$500 – $1,500',
  timeline: 'Within 1 month',
  websiteUrl: 'https://old.example.co.zw',
  description: 'A new website for our transport company with a quote request form.',
  name: 'Tendai Example',
  email: 'tendai@example.com',
  consent: true,
  turnstileToken: 'test',
  ...over,
});

let ipSeq = 0;
async function post(data: unknown, file?: { bytes: Uint8Array<ArrayBuffer>; name: string; type: string }) {
  const form = new FormData();
  form.set('data', typeof data === 'string' ? data : JSON.stringify(data));
  if (file) form.set('attachment', new File([file.bytes], file.name, { type: file.type }));
  const res = await exports.default.fetch(`${ORIGIN}/api/v1/public/project-requests`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'cf-connecting-ip': `10.9.0.${++ipSeq}` },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('Start-a-Project wizard submissions (docs/12 §C.2)', () => {
  beforeAll(async () => {
    await seedBase();
    resetCmsCache();
  });

  it('creates a wizard enquiry with a structured brief, package link, indicative estimate and attachment', async () => {
    const support = await createStaff(['support_staff']);
    const res = await post(valid(), { bytes: pdf(), name: 'brief.pdf', type: 'application/pdf' });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare('SELECT * FROM enquiries WHERE reference = ?')
      .bind(res.body.data.reference)
      .first<any>();
    expect(row).toMatchObject({
      kind: 'wizard',
      category: 'websites',
      service_id: 'svc_websites__business_website',
      package_id: 'pkg_business_website',
      budget_range: '$500 – $1,500',
      message: 'A new website for our transport company with a quote request form.',
    });
    const brief = JSON.parse(row.brief);
    expect(brief).toMatchObject({
      version: 1,
      division: { slug: 'websites' },
      package: { slug: 'business-website', name: 'Business Website' },
      addons: [{ id: 'pad_logo_design' }, { id: 'pad_copywriting' }],
      features: [{ value: 'online_payments' }, { value: 'blog' }],
      timeline: 'Within 1 month',
      websiteUrl: 'https://old.example.co.zw',
      // $320 Business Website + $50 logo + $15 copywriting (each add-on counted once), all one-off.
      estimate: {
        currency: 'USD',
        oneOffLowMinor: 38500,
        oneOffHighMinor: 38500,
        recurring: [],
      },
    });
    const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(row.attachment_file_id).first<any>();
    expect(file).toMatchObject({
      owner_type: 'enquiry',
      owner_id: row.id,
      visibility: 'private',
      mime_type: 'application/pdf',
    });
    expect(brief.attachment).toMatchObject({ fileId: file.id, name: 'brief.pdf' });
    const note = await env.DB.prepare(
      "SELECT title, link FROM notifications WHERE user_id = ? AND entity_id = ? AND type = 'enquiry.new'",
    )
      .bind(support.id, row.id)
      .first<any>();
    expect(note).toMatchObject({ title: 'Project request from Tendai Example', link: `/admin/enquiries/${row.id}` });
  });

  it('works without a package (custom project) and without an attachment', async () => {
    const res = await post(valid({ package: '', addons: [], service: undefined, websiteUrl: '' }));
    expect(res.status).toBe(201);
    const row = await env.DB.prepare('SELECT package_id, attachment_file_id, brief FROM enquiries WHERE reference = ?')
      .bind(res.body.data.reference)
      .first<any>();
    expect(row.package_id).toBeNull();
    expect(row.attachment_file_id).toBeNull();
    expect(JSON.parse(row.brief)).toMatchObject({ package: null, estimate: null, websiteUrl: null });
  });

  it('rejects unknown packages, packages from another division, unknown add-ons and bad fields', async () => {
    expect((await post(valid({ package: 'no-such' }))).body.error.fields.package).toBeDefined();
    expect((await post(valid({ package: 'pos-inventory-system' }))).body.error.fields.package).toBeDefined();
    expect((await post(valid({ addons: ['pad_nope'] }))).body.error.fields.addons).toBeDefined();
    const bad = await post(valid({ timeline: 'tomorrow', websiteUrl: 'javascript:alert(1)', consent: false }));
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['consent', 'timeline', 'websiteUrl']);
    expect((await post('{not json')).status).toBe(422);
  });

  it('rejects disallowed attachment types without storing anything', async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) n FROM enquiries').first<any>();
    const res = await post(valid(), { bytes: exe(), name: 'brief.pdf', type: 'application/pdf' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.file).toBeDefined();
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM enquiries').first<any>()).n).toBe(before.n);
  });

  it('stores no estimate when public prices are switched off', async () => {
    await env.DB.batch([
      env.DB.prepare("UPDATE application_settings SET value = 'false' WHERE key = 'pricing.show_prices'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const res = await post(valid());
    const row = await env.DB.prepare('SELECT brief FROM enquiries WHERE reference = ?')
      .bind(res.body.data.reference)
      .first<any>();
    expect(JSON.parse(row.brief).estimate).toBeNull();
    await env.DB.batch([
      env.DB.prepare("UPDATE application_settings SET value = 'true' WHERE key = 'pricing.show_prices'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
  });

  it('honeypot submissions store nothing but look successful', async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) n FROM enquiries').first<any>();
    const res = await post(valid({ website: 'http://spam.example' }));
    expect(res.status).toBe(201);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM enquiries').first<any>()).n).toBe(before.n);
  });
});
