import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  bumpContentVersionStmt,
  FAQ_CATEGORIES,
  listAllFaqs,
  listTechnologies,
  listTestimonials,
  resetCmsCache,
  searchSite,
  searchTerms,
} from '../../src/server/modules/cms';
import { createClient } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const ctx = () => createContext({ env, now: () => new Date('2026-11-05T10:00:00Z') });
const fresh = async (...stmts: D1PreparedStatement[]) => {
  await env.DB.batch([...stmts, bumpContentVersionStmt(env.DB)]);
  resetCmsCache();
};

describe('FAQ, technologies, testimonials and search (P3.16)', () => {
  beforeEach(async () => {
    await seedBase();
    await fresh(env.DB.prepare('DELETE FROM testimonials'));
  });

  it('has at least 20 published FAQs covering every category', async () => {
    const faqs = await listAllFaqs(ctx());
    expect(faqs.length).toBeGreaterThanOrEqual(20);
    for (const c of FAQ_CATEGORIES)
      expect(
        faqs.some((f) => f.category === c.key),
        c.key,
      ).toBe(true);
    await fresh(env.DB.prepare("UPDATE faqs SET published = 0 WHERE id = 'faq_general_who'"));
    expect((await listAllFaqs(ctx())).map((f) => f.id)).not.toContain('faq_general_who');
    await fresh(env.DB.prepare("UPDATE faqs SET published = 1 WHERE id = 'faq_general_who'"));
  });

  it('lists technologies, and only same-origin SVG logos', async () => {
    // Seeded unpublished since R9.1 (no tech stack on public pages, REFINEMENTS §4): nothing is listed until published.
    expect(await listTechnologies(ctx())).toEqual([]);
    await fresh(env.DB.prepare('UPDATE technologies SET published = 1'));
    await fresh(
      env.DB.prepare("UPDATE technologies SET logo_svg_path = 'https://evil.example/x.svg' WHERE name = 'React'"),
    );
    const tech = await listTechnologies(ctx());
    expect(tech.map((t) => t.name)).toContain('Cloudflare');
    expect(tech.find((t) => t.name === 'React')!.logo).toBeNull();
  });

  it('testimonials: none by default; consent is required by the schema; only published ones show', async () => {
    expect(await listTestimonials(ctx())).toEqual([]);
    const client = await createClient();
    await expect(
      env.DB.prepare(
        `INSERT INTO testimonials (id, client_id, author_name, quote, consent_obtained, consent_date, published)
         VALUES ('tst_noconsent', ?, 'A Person', 'Great work.', 0, '2026-11-01', 1)`,
      )
        .bind(client.id)
        .run(),
    ).rejects.toThrow(/CHECK/);
    await fresh(
      env.DB.prepare(
        `INSERT INTO testimonials (id, client_id, author_name, author_role, quote, consent_obtained, consent_date, published)
         VALUES ('tst_pub', ?1, 'Real Person', 'Director', 'Clear and dependable.', 1, '2026-11-01', 1),
                ('tst_draft', ?1, 'Other Person', NULL, 'Not yet approved.', 1, '2026-11-01', 0)`,
      ).bind(client.id),
    );
    expect(await listTestimonials(ctx())).toEqual([
      { quote: 'Clear and dependable.', author: 'Real Person', role: 'Director' },
    ]);
  });

  it('search covers services, packages, industries, insights and FAQ, ranking title matches first', async () => {
    expect(searchTerms('  EcoCash!! a  x'.repeat(1))).toEqual(['ecocash']);
    expect(searchTerms('a'.repeat(500)).join('').length).toBeLessThanOrEqual(100);
    expect(await searchSite(ctx(), '')).toEqual([]);

    const payments = await searchSite(ctx(), 'payment');
    const kinds = new Set(payments.map((r) => r.kind));
    for (const k of ['service', 'package', 'insight', 'faq'] as const) expect(kinds.has(k), k).toBe(true);
    expect(payments[0]!.title.toLowerCase()).toContain('payment');

    const pos = await searchSite(ctx(), 'POS');
    expect(pos[0]).toMatchObject({
      kind: 'service',
      title: 'POS & Inventory Systems',
      href: '/services/business-software',
    });
    // Removed offers are not found (REFINEMENTS §1).
    for (const q of ['care plan', 'hosting', 'business suite'])
      expect(
        (await searchSite(ctx(), q)).filter((r) => r.kind === 'service' || r.kind === 'package'),
        q,
      ).toEqual([]);
    expect((await searchSite(ctx(), 'logistics'))[0]).toMatchObject({
      kind: 'industry',
      href: '/industries/logistics-transport',
    });
    expect(await searchSite(ctx(), 'zzzqqq')).toEqual([]);
    // Every result points at a site path.
    for (const r of [...payments, ...pos]) expect(r.href).toMatch(/^\/[a-z0-9#/_-]*$/);
  });
});
