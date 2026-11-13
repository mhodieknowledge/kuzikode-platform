import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  getIndustry,
  getPost,
  listAllFaqs,
  listIndustries,
  listPosts,
  listTechnologies,
  listTestimonials,
  publishDuePosts,
  resetCmsCache,
} from '../../src/server/modules/cms';
import { api, login } from '../helpers/api';
import { createClient, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const C = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/content${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();
const version = async () =>
  Number((await row("SELECT value FROM application_settings WHERE key = 'content_version'")).value);
const pub = (iso?: string) => {
  resetCmsCache();
  return createContext({ env, ...(iso ? { now: () => new Date(iso) } : {}) });
};

const post = (over: Record<string, unknown> = {}) => ({
  slug: 'invoices-that-get-paid',
  title: 'Invoices that get paid on time',
  excerpt: 'Small changes to how you send invoices that shorten the wait for payment.',
  body: '<h2>Start with clear terms</h2><p>Say when payment is due.</p><script>alert(1)</script>',
  categoryId: 'pcat_guides',
  tags: ['Payments', 'Small business', 'payments'],
  authorDisplayName: 'Kuzikode Intelligent Technologies',
  status: 'draft',
  ...over,
});

describe('content admin (P4.22)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
    resetCmsCache();
  });

  it('insights: drafts stay private, publishing and scheduling reach the public site, tags and HTML are cleaned', async () => {
    const cm = await staff(['content_manager']);
    const v0 = await version();
    const res = await C(cm, '/posts', post());
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const id = res.body.data.id as string;
    expect(await version()).toBe(v0 + 1);
    expect((await listPosts(pub())).some((p) => p.slug === 'invoices-that-get-paid')).toBe(false);

    const got = (await C(cm, `/posts/${id}`)).body.data;
    expect(got.body).not.toContain('<script');
    expect(got.tags).toEqual(['Payments', 'Small business']);
    expect(got.reading_minutes).toBe(1);

    // Publishing stamps a date once; later edits keep it.
    expect((await C(cm, `/posts/${id}`, post({ status: 'published' }), 'PUT')).status).toBe(200);
    const first = (await row('SELECT published_at FROM posts WHERE id = ?', id)).published_at;
    expect(first).toBeTruthy();
    await C(cm, `/posts/${id}`, post({ status: 'published', title: 'Invoices that get paid' }), 'PUT');
    expect((await row('SELECT published_at FROM posts WHERE id = ?', id)).published_at).toBe(first);
    const live = await getPost(pub(), 'invoices-that-get-paid');
    expect(live?.title).toBe('Invoices that get paid');
    expect(live?.tags.map((t) => t.slug).sort()).toEqual(['payments', 'small-business']);

    // Published articles can't be deleted; drafts can.
    expect((await C(cm, `/posts/${id}`, undefined, 'DELETE')).status).toBe(409);
    await C(cm, `/posts/${id}`, post({ status: 'draft' }), 'PUT');
    expect((await C(cm, `/posts/${id}`, undefined, 'DELETE')).status).toBe(200);
    expect(await row('SELECT id FROM posts WHERE id = ?', id)).toBeNull();
    expect(await row("SELECT id FROM audit_logs WHERE action = 'post.deleted' AND entity_id = ?", id)).not.toBeNull();

    // Scheduling: the time must be in the future; the cron publishes it when due.
    const past = await C(
      cm,
      '/posts',
      post({ slug: 'scheduled-one', status: 'scheduled', publishAt: '2020-01-01T09:00' }),
    );
    expect(past.status).toBe(422);
    expect(past.body.error.fields.publishAt).toBeTruthy();
    const sch = await C(
      cm,
      '/posts',
      post({ slug: 'scheduled-one', status: 'scheduled', publishAt: '2099-01-01T09:00' }),
    );
    expect(sch.status).toBe(201);
    expect((await listPosts(pub())).some((p) => p.slug === 'scheduled-one')).toBe(false);
    expect(await publishDuePosts(pub('2099-01-01T09:01:00Z'))).toBe(1);
    expect((await listPosts(pub())).find((p) => p.slug === 'scheduled-one')?.publishedAt).toBe('2099-01-01T09:00:00Z');

    // Slugs are unique; unknown categories are refused.
    expect((await C(cm, '/posts', post({ slug: 'scheduled-one' }))).status).toBe(422);
    expect((await C(cm, '/posts', post({ slug: 'x-new', categoryId: 'pct_nope' }))).status).toBe(422);
  });

  it('insights categories: create, rename, refuse deleting one in use', async () => {
    const cm = await staff(['content_manager']);
    const res = await C(cm, '/post-categories', { slug: 'case-notes', name: 'Case notes', sortOrder: 90 });
    expect(res.status).toBe(201);
    const cid = res.body.data.id as string;
    expect(
      (await C(cm, `/post-categories/${cid}`, { slug: 'case-notes', name: 'Notes', sortOrder: 90 }, 'PUT')).status,
    ).toBe(200);
    expect((await C(cm, '/post-categories', { slug: 'case-notes', name: 'Dupe', sortOrder: 1 })).status).toBe(422);
    expect((await C(cm, '/posts', post({ slug: 'in-notes', categoryId: cid }))).status).toBe(201);
    expect((await C(cm, `/post-categories/${cid}`, undefined, 'DELETE')).status).toBe(409);
    expect((await C(cm, '/post-categories')).body.data.find((c: any) => c.id === cid).posts).toBe(1);
  });

  it('industries: challenges and linked services reach the public page; drafts are hidden', async () => {
    const cm = await staff(['content_manager']);
    const body = {
      slug: 'mining-services',
      name: 'Mining services',
      summary: 'Software for contractors and suppliers to the mining sector.',
      challenges: [{ title: 'Remote sites', body: 'Work that keeps going on weak connections.' }],
      body: '<p>Details</p><img src=x onerror=alert(1)>',
      icon: 'layers',
      status: 'draft',
      sortOrder: 5,
      serviceIds: ['svc_websites__business_website'],
    };
    expect((await C(cm, '/industries', { ...body, serviceIds: ['svc_missing'] })).status).toBe(422);
    expect((await C(cm, '/industries', { ...body, icon: 'rocket' })).status).toBe(422);
    const res = await C(cm, '/industries', body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const id = res.body.data.id as string;
    expect((await listIndustries(pub())).some((i) => i.slug === 'mining-services')).toBe(false);
    await C(cm, `/industries/${id}`, { ...body, status: 'published' }, 'PUT');
    const live = await getIndustry(pub(), 'mining-services');
    expect(live?.challenges).toEqual(body.challenges);
    expect(live?.serviceIds).toEqual(['svc_websites__business_website']);
    expect(live?.body).not.toContain('onerror');
    expect((await C(cm, `/industries/${id}`)).body.data.serviceIds).toEqual(['svc_websites__business_website']);
    expect((await C(cm, `/industries/${id}`, undefined, 'DELETE')).status).toBe(200);
    expect(await row('SELECT 1 AS x FROM industry_services WHERE industry_id = ?', id)).toBeNull();
  });

  it('FAQ and technologies: publish flags, validation and the public readers', async () => {
    const cm = await staff(['content_manager']);
    const faq = {
      category: 'pricing',
      question: 'Can I pay in ZWG?',
      answer: 'Yes, at the rate on the invoice.',
      sortOrder: 1,
      published: false,
    };
    const f = await C(cm, '/faqs', faq);
    expect(f.status).toBe(201);
    expect((await listAllFaqs(pub())).some((x) => x.question === faq.question)).toBe(false);
    await C(cm, `/faqs/${f.body.data.id}`, { ...faq, published: true }, 'PUT');
    expect((await listAllFaqs(pub())).some((x) => x.question === faq.question)).toBe(true);
    expect((await C(cm, '/faqs', { ...faq, category: 'legal' })).status).toBe(422);
    expect((await C(cm, `/faqs/${f.body.data.id}`, undefined, 'DELETE')).status).toBe(200);

    const tech = { name: 'Rust', category: 'Languages', logoSvgPath: '/tech/rust.svg', sortOrder: 5, published: true };
    expect((await C(cm, '/technologies', { ...tech, logoSvgPath: 'https://evil.example/x.svg' })).status).toBe(422);
    const t = await C(cm, '/technologies', tech);
    expect(t.status).toBe(201);
    expect((await C(cm, '/technologies', { ...tech, name: 'rust' })).status).toBe(422);
    expect((await listTechnologies(pub())).find((x) => x.name === 'Rust')).toEqual({
      name: 'Rust',
      category: 'Languages',
      logo: '/tech/rust.svg',
    });
    await C(cm, `/technologies/${t.body.data.id}`, { ...tech, published: false }, 'PUT');
    expect((await listTechnologies(pub())).some((x) => x.name === 'Rust')).toBe(false);
  });

  it('testimonials require a real client, recorded consent with a past date, and a matching project', async () => {
    const cm = await staff(['content_manager']);
    const client = await createClient('Harare Hardware (Pvt) Ltd');
    const other = await createClient('Other Co');
    await env.DB.prepare(
      "INSERT INTO projects (id, reference, client_id, name, status) VALUES ('prj_t_other', 'PRJ-T-1', ?, 'Other site', 'active')",
    )
      .bind(other.id)
      .run();
    const t = {
      clientId: client.id,
      authorName: 'T. Moyo',
      authorRole: 'Director',
      quote: 'Our orders now arrive in one place and nothing gets lost.',
      consentObtained: true,
      consentDate: '2026-10-01',
      published: true,
    };
    const noConsent = await C(cm, '/testimonials', { ...t, consentObtained: false });
    expect(noConsent.status).toBe(422);
    expect(noConsent.body.error.fields.consentObtained).toBeTruthy();
    expect((await C(cm, '/testimonials', { ...t, consentDate: undefined })).status).toBe(422);
    expect((await C(cm, '/testimonials', { ...t, consentDate: '2099-01-01' })).status).toBe(422);
    expect((await C(cm, '/testimonials', { ...t, clientId: 'cli_missing' })).status).toBe(422);
    expect((await C(cm, '/testimonials', { ...t, projectId: 'prj_t_other' })).status).toBe(422);
    expect((await listTestimonials(pub())).length).toBe(0);

    const ok = await C(cm, '/testimonials', t);
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(await listTestimonials(pub())).toEqual([{ quote: t.quote, author: 'T. Moyo', role: 'Director' }]);
    const audit = await row(
      "SELECT after FROM audit_logs WHERE action = 'testimonial.created' AND entity_id = ?",
      ok.body.data.id,
    );
    expect(JSON.parse(audit.after)).toMatchObject({ clientId: client.id, consentDate: '2026-10-01' });

    // The database refuses an unconsented row even if application checks were bypassed.
    await expect(
      env.DB.prepare(
        "INSERT INTO testimonials (id, client_id, author_name, quote, consent_obtained, consent_date) VALUES ('tst_x', ?, 'X', 'Quote text here', 0, '2026-01-01')",
      )
        .bind(client.id)
        .run(),
    ).rejects.toThrow();

    await C(cm, `/testimonials/${ok.body.data.id}`, { ...t, published: false }, 'PUT');
    expect((await listTestimonials(pub())).length).toBe(0);
  });

  it('permissions: support staff are refused; newsletter view vs export; CSV defaults to confirmed and is audited', async () => {
    const support = await staff(['support_staff']);
    expect((await C(support, '/posts')).status).toBe(403);
    expect((await C(support, '/faqs', { category: 'general', question: 'Question?', answer: 'Answer.' })).status).toBe(
      403,
    );

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO newsletter_subscribers (id, email, status, source, confirmed_at, created_at) VALUES ('nws_a', 'a@example.com', 'confirmed', 'footer', '2026-10-02T00:00:00Z', '2026-10-01T00:00:00Z')",
      ),
      env.DB.prepare(
        "INSERT INTO newsletter_subscribers (id, email, status, source, created_at) VALUES ('nws_b', 'b@example.com', 'pending', 'footer', '2026-10-03T00:00:00Z')",
      ),
      env.DB.prepare(
        "INSERT INTO newsletter_subscribers (id, email, status, source, confirmed_at, created_at, ip_hash) VALUES ('nws_c', '=cmd@example.com', 'confirmed', '=HYPERLINK(1)', '2026-10-05T00:00:00Z', '2026-10-04T00:00:00Z', 'secret-hash')",
      ),
    ]);
    const cm = await staff(['content_manager']);
    const list = await C(cm, '/newsletter?status=confirmed');
    expect(list.status).toBe(200);
    expect(list.body.data.items.map((i: any) => i.email)).toEqual(['=cmd@example.com', 'a@example.com']);
    expect(list.body.data.counts).toMatchObject({ confirmed: 2, pending: 1 });
    expect(JSON.stringify(list.body)).not.toContain('secret-hash');
    expect((await C(cm, '/newsletter?q=b%40')).body.data.items.map((i: any) => i.email)).toEqual(['b@example.com']);
    expect((await C(cm, '/newsletter/export.csv')).status).toBe(403);

    const admin = await staff(['admin']);
    const csv = await C(admin, '/newsletter/export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.headers.get('cache-control')).toContain('no-store');
    const lines = String(csv.body).trim().split('\r\n');
    expect(lines[0]).toBe('Email,Status,Source,Confirmed at,Unsubscribed at,Signed up at');
    expect(lines).toHaveLength(3);
    expect(String(csv.body)).not.toContain('b@example.com');
    expect(String(csv.body)).toContain("'=cmd@example.com");
    expect(String(csv.body)).toContain("'=HYPERLINK(1)");
    const audit = await row(
      "SELECT after FROM audit_logs WHERE action = 'newsletter.exported' ORDER BY created_at DESC LIMIT 1",
    );
    expect(JSON.parse(audit.after)).toEqual({ status: 'confirmed', q: null, rows: 2 });
    expect(audit.after).not.toContain('@');
  });
});
