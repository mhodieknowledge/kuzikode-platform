import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { processOutbox } from '../../src/server/jobs/consumer';
import { api } from '../helpers/api';
import { createStaff } from '../helpers/factories';

const valid = (over: Record<string, unknown> = {}) => ({
  name: 'Farai Example',
  email: 'Farai@Example.com',
  category: 'websites',
  service: 'ecommerce-website',
  budgetRange: '$1,500 – $5,000',
  message: 'We would like an online store for our hardware shop.',
  consent: true,
  turnstileToken: 'test',
  ...over,
});

const post = (body: unknown, ip = '10.0.0.1') =>
  api('/api/v1/public/enquiries', { body, headers: { 'cf-connecting-ip': ip } });

describe('public enquiries', () => {
  it('stores the enquiry, notifies staff, queues both emails and returns a reference', async () => {
    const support = await createStaff(['support_staff']);
    await env.DB.prepare(
      "UPDATE application_settings SET value = '\"hello@kuzikode.example\"' WHERE key = 'contact.email'",
    ).run();
    const res = await post(valid(), '10.0.0.2');
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^ENQ-\d{4}-\d{4}$/);
    const row = await env.DB.prepare('SELECT * FROM enquiries WHERE reference = ?')
      .bind(res.body.data.reference)
      .first<any>();
    expect(row).toMatchObject({
      email: 'farai@example.com',
      category: 'websites',
      status: 'new',
      kind: 'contact',
    });
    expect(row.service_id).toBe('svc_websites__ecommerce_website');
    expect(row.ip_hash).not.toContain('10.0.0.2');
    const note = await env.DB.prepare("SELECT title FROM notifications WHERE user_id = ? AND type = 'enquiry.new'")
      .bind(support.id)
      .first<any>();
    expect(note.title).toBe('New enquiry from Farai Example');
    const jobs = await env.DB.prepare(
      "SELECT id, json_extract(payload,'$.template') t FROM outbox WHERE idempotency_key LIKE ?",
    )
      .bind(`%${row.id}`)
      .all<any>();
    expect(jobs.results.map((j: any) => j.t).sort()).toEqual(['enquiry_acknowledgement', 'enquiry_admin']);
    const ctx = createContext({ env, actor: { type: 'system', userId: null } });
    for (const j of jobs.results) expect((await processOutbox(ctx, j.id)).outcome).toBe('done');
    const ack = await env.DB.prepare(
      "SELECT subject, text FROM email_logs WHERE template = 'enquiry_acknowledgement' AND to_email = 'farai@example.com'",
    ).first<any>();
    expect(ack.subject).toContain(res.body.data.reference);
    await env.DB.prepare("UPDATE application_settings SET value = '\"\"' WHERE key = 'contact.email'").run();
  });

  it('validates input with field errors', async () => {
    const res = await post(valid({ email: 'nope', message: 'short', consent: false }), '10.0.0.3');
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['consent', 'email', 'message']);
    expect((await post({ ...valid(), extra: 'x' }, '10.0.0.3')).status).toBe(422);
  });

  it('honeypot submissions get a normal-looking answer but store nothing', async () => {
    const before = await env.DB.prepare('SELECT count(*) n FROM enquiries').first<any>();
    const res = await post(valid({ website: 'http://spam.example' }), '10.0.0.4');
    expect(res.status).toBe(201);
    const after = await env.DB.prepare('SELECT count(*) n FROM enquiries').first<any>();
    expect(after.n).toBe(before.n);
  });

  it('rate-limits to 5 per hour per IP and rejects foreign origins', async () => {
    for (let i = 0; i < 5; i++) expect((await post(valid(), '10.0.0.9')).status).toBe(201);
    const limited = await post(valid(), '10.0.0.9');
    expect(limited.status).toBe(429);
    const foreign = await api('/api/v1/public/enquiries', {
      body: valid(),
      origin: 'https://evil.example',
      headers: { 'cf-connecting-ip': '10.0.0.10' },
    });
    expect(foreign.status).toBe(403);
  });

  it('requires a Turnstile token and accepts product interest only for products with the form enabled', async () => {
    expect((await post(valid({ turnstileToken: undefined }), '10.0.0.11')).status).toBe(422);
    const interest = valid({
      kind: 'product_interest',
      category: 'product_interest',
      product: 'business-suite',
      service: undefined,
    });
    // Products are unpublished since R9.1 (REFINEMENTS §1): no interest is accepted until the owner publishes one again.
    expect((await post(interest, '10.0.0.12')).status).toBe(422);
    await env.DB.prepare("UPDATE products SET published = 1 WHERE id = 'prd_business_suite'").run();
    const ok = await post(
      valid({ kind: 'product_interest', category: 'product_interest', product: 'business-suite', service: undefined }),
      '10.0.0.12',
    );
    expect(ok.status).toBe(201);
    const row = await env.DB.prepare('SELECT kind, product_id FROM enquiries WHERE reference = ?')
      .bind(ok.body.data.reference)
      .first<any>();
    expect(row).toEqual({ kind: 'product_interest', product_id: 'prd_business_suite' });
    expect(
      (await post(valid({ kind: 'product_interest', product: 'nope', service: undefined }), '10.0.0.12')).status,
    ).toBe(422);
    await env.DB.prepare("UPDATE products SET published = 0 WHERE id = 'prd_business_suite'").run();
  });
});
