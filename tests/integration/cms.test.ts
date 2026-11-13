import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  bumpContentVersionStmt,
  contentVersion,
  currentAnnouncement,
  getCategory,
  getPage,
  getServiceCatalogue,
  getSettings,
  listPortfolio,
  listProducts,
  resetCmsCache,
  sectionOf,
  settingText,
} from '../../src/server/modules/cms';
import { seedBase } from '../helpers/seed';

const ctx = () => createContext({ env, now: () => new Date('2026-11-05T10:00:00Z') });

describe('CMS read layer', () => {
  beforeEach(async () => {
    await seedBase();
    resetCmsCache();
  });

  it('reads the published home page with typed sections', async () => {
    const page = await getPage(ctx(), 'home');
    expect(page!.seoTitle).toContain('Kuzikode');
    const hero = sectionOf(page, 'hero', 'hero');
    expect(hero!.content.title).toBe('Building intelligent digital solutions.');
    expect(page!.sections.map((s) => s.key)).toEqual(['hero', 'services', 'why', 'work', 'process', 'values', 'cta']);
  });

  it('serves cached content until content_version is bumped', async () => {
    const c = ctx();
    expect((await getPage(c, 'home'))!.sections.length).toBe(7);
    await env.DB.prepare("UPDATE website_sections SET visible = 0 WHERE id = 'sec_home__values'").run();
    resetCmsCache(); // simulate another isolate: KV still has the old version's entry
    expect((await getPage(c, 'home'))!.sections.length).toBe(7);
    const before = await contentVersion(c);
    await bumpContentVersionStmt(env.DB).run();
    resetCmsCache();
    expect(await contentVersion(c)).toBe(before + 1);
    expect((await getPage(c, 'home'))!.sections.map((s) => s.key)).not.toContain('values');
    await env.DB.prepare("UPDATE website_sections SET visible = 1 WHERE id = 'sec_home__values'").run();
    await bumpContentVersionStmt(env.DB).run();
  });

  it('skips sections whose content is invalid and sanitizes rich text', async () => {
    await env.DB.batch([
      env.DB.prepare(`UPDATE website_sections SET published_content = '{"title":""}' WHERE id = 'sec_about__mission'`),
      env.DB.prepare(
        `UPDATE website_sections SET published_content = '{"title":"About","html":"<p>Hi<script>alert(1)</script></p>"}' WHERE id = 'sec_about__overview'`,
      ),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const page = await getPage(ctx(), 'about');
    expect(page!.sections.map((s) => s.key)).not.toContain('mission');
    expect(sectionOf(page, 'overview', 'rich_text')!.content.html).toBe('<p>Hi</p>');
  });

  it('hides inactive divisions/services and marks coming-soon ones', async () => {
    await env.DB.batch([
      env.DB.prepare("UPDATE service_categories SET status = 'inactive' WHERE slug = 'ai-data'"),
      env.DB.prepare("UPDATE service_categories SET status = 'coming_soon' WHERE slug = 'add-ons'"),
      env.DB.prepare("UPDATE services SET status = 'inactive' WHERE slug = 'pos'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const cats = await getServiceCatalogue(ctx());
    expect(cats.map((c) => c.slug)).not.toContain('ai-data');
    expect(cats.find((c) => c.slug === 'add-ons')!.status).toBe('coming_soon');
    expect((await getCategory(ctx(), 'business-software'))!.services.map((s) => s.slug)).not.toContain('pos');
    expect(await getCategory(ctx(), 'ai-data')).toBeNull();
    await env.DB.batch([
      env.DB.prepare("UPDATE service_categories SET status = 'active'"),
      env.DB.prepare("UPDATE services SET status = 'active'"),
      bumpContentVersionStmt(env.DB),
    ]);
  });

  it('shows only published portfolio entries and hides client names unless allowed', async () => {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO portfolio_projects (id, slug, name, client_name, show_client_name, category, summary, status) VALUES ('pfo_1','draft-one','Draft','Secret Co',1,'web','x','draft')",
      ),
      env.DB.prepare(
        "INSERT INTO portfolio_projects (id, slug, name, client_name, show_client_name, category, summary, status) VALUES ('pfo_2','pub-one','Published','Hidden Co',0,'web','x','published')",
      ),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const items = await listPortfolio(ctx());
    expect(items.map((i) => i.slug)).toEqual(['pub-one']);
    expect(items[0]!.clientName).toBeNull();
  });

  it('reads settings, products and time-windowed announcements', async () => {
    const s = await getSettings(ctx());
    expect(settingText(s, 'company.name')).toBe('Kuzikode Technologies');
    expect(settingText(s, 'contact.phone')).toBeUndefined();
    // Products are seeded unpublished (no products on public pages, REFINEMENTS §1); a published one is listed.
    expect(await listProducts(ctx())).toEqual([]);
    await env.DB.batch([
      env.DB.prepare("UPDATE products SET published = 1 WHERE id = 'prd_business_suite'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    expect((await listProducts(ctx()))[0]).toMatchObject({ name: 'Kuzikode Business Suite', status: 'in_development' });
    await env.DB.prepare("UPDATE products SET published = 0 WHERE id = 'prd_business_suite'").run();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO announcements (id, message, starts_at, ends_at) VALUES ('ann_1','Office closed on Friday','2026-11-01T00:00:00Z','2026-11-10T00:00:00Z')",
      ),
      env.DB.prepare(
        "INSERT INTO announcements (id, message, starts_at) VALUES ('ann_2','Future notice','2027-01-01T00:00:00Z')",
      ),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    expect((await currentAnnouncement(ctx()))!.message).toBe('Office closed on Friday');
    const later = createContext({ env, now: () => new Date('2026-12-01T00:00:00Z') });
    expect(await currentAnnouncement(later)).toBeNull();
  });
});

describe('portfolio visibility', () => {
  it('a draft never appears and its slug does not resolve', async () => {
    const { getPortfolioItem } = await import('../../src/server/modules/cms');
    await seedBase();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO portfolio_projects (id, slug, name, category, summary, status) VALUES ('pfo_d2','secret-draft','Draft','web','x','draft')",
      ),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    expect(await getPortfolioItem(ctx(), 'secret-draft')).toBeNull();
  });
});
