import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { runScheduled, CRON_FREQUENT } from '../../src/server/jobs/scheduled';
import {
  articleLd,
  bumpContentVersionStmt,
  findPosts,
  getPost,
  listPostCategories,
  listPosts,
  publishDuePosts,
  relatedPosts,
  renderRss,
  resetCmsCache,
  contentVersion,
} from '../../src/server/modules/cms';
import { seedBase } from '../helpers/seed';

const at = (iso: string) => createContext({ env, now: () => new Date(iso) });
const ctx = () => at('2026-11-05T10:00:00Z');

const insertPost = (slug: string, status: string, publishAt: string | null, publishedAt: string | null = null) =>
  env.DB.batch([
    env.DB.prepare(
      `INSERT OR REPLACE INTO posts (id, slug, title, excerpt, body, category_id, author_display_name, reading_minutes, status, publish_at, published_at)
     VALUES (?, ?, ?, 'Excerpt', '<p>Body <script>alert(1)</script></p>', 'pcat_guides', 'Kuzikode Intelligent Technologies', 1, ?, ?, ?)`,
    ).bind(`post_${slug}`, slug, `Title ${slug} & <more>`, status, publishAt, publishedAt),
    bumpContentVersionStmt(env.DB),
  ]);

describe('insights (docs/12 §C.4)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.batch([env.DB.prepare("DELETE FROM posts WHERE id LIKE 'post_t_%'"), bumpContentVersionStmt(env.DB)]);
    resetCmsCache();
  });

  it('lists the 4 launch articles newest first with category, tags and reading time; no invented statistics', async () => {
    const posts = await listPosts(ctx());
    expect(posts).toHaveLength(4);
    for (const p of posts) {
      expect(p.category).not.toBeNull();
      expect(p.tags.length).toBeGreaterThan(0);
      expect(p.readingMinutes).toBeGreaterThanOrEqual(2);
      const full = await getPost(ctx(), p.slug);
      expect(full!.body).not.toMatch(/\d+(\.\d+)?\s?%|\bper cent\b|million|billion/i);
    }
    const cats = await listPostCategories(ctx());
    expect(cats.find((c) => c.slug === 'payments')!.count).toBe(1);
    expect((await findPosts(ctx(), { category: 'payments' })).posts.map((p) => p.slug)).toEqual([
      'accepting-ecocash-and-card-payments-on-your-website',
    ]);
    expect((await findPosts(ctx(), { tag: 'small-business' })).total).toBe(4);
    expect((await findPosts(ctx(), { page: 99 })).page).toBe(1);
  });

  it('drafts and future scheduled posts are hidden; the 5-minute cron publishes due posts and turns caches over', async () => {
    await insertPost('t_draft', 'draft', null);
    await insertPost('t_sched', 'scheduled', '2026-11-05T12:00:00.000Z');
    resetCmsCache();
    const before = await contentVersion(ctx());
    expect((await listPosts(ctx())).map((p) => p.slug)).not.toContain('t_sched');
    expect(await getPost(ctx(), 't_sched')).toBeNull();

    expect(await publishDuePosts(at('2026-11-05T11:00:00Z'))).toBe(0);
    resetCmsCache();
    expect(await contentVersion(ctx())).toBe(before);

    const outcome = await runScheduled(at('2026-11-05T12:05:00Z'), { cron: CRON_FREQUENT, scheduledTime: 0 });
    expect(outcome['publish-due-posts']).toBe('ok');
    resetCmsCache();
    expect(await contentVersion(ctx())).toBe(before + 1);
    const slugs = (await listPosts(ctx())).map((p) => p.slug);
    expect(slugs).toContain('t_sched');
    expect(slugs).not.toContain('t_draft');
    const post = await getPost(ctx(), 't_sched');
    expect(post!.publishedAt).toBe('2026-11-05T12:00:00.000Z');
    expect(post!.body).not.toContain('<script');
  });

  it('related posts prefer the same category, then shared tags', async () => {
    await insertPost('t_guide', 'published', '2026-11-01T08:00:00.000Z', '2026-11-01T08:00:00.000Z');
    resetCmsCache();
    const post = await getPost(ctx(), 'choosing-between-a-website-and-a-web-app');
    const related = await relatedPosts(ctx(), post!);
    expect(related).toHaveLength(3);
    expect(related[0]!.slug).toBe('t_guide');
    expect(related.map((r) => r.slug)).not.toContain(post!.slug);
  });

  it('renders Article JSON-LD and an escaped RSS 2.0 feed', async () => {
    await insertPost('t_rss', 'published', '2026-11-06T08:00:00.000Z', '2026-11-06T08:00:00.000Z');
    resetCmsCache();
    const post = await getPost(ctx(), 'business-email-on-your-own-domain');
    expect(articleLd(ctx(), post!)).toMatchObject({
      '@type': 'Article',
      headline: post!.title,
      datePublished: '2026-11-05T08:00:00.000Z',
      mainEntityOfPage: expect.stringMatching(/\/insights\/business-email-on-your-own-domain$/),
    });
    const rss = renderRss(ctx(), await listPosts(ctx()));
    expect(rss).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect(rss.match(/<item>/g)).toHaveLength(5);
    expect(rss).toContain('<title>Title t_rss &amp; &lt;more&gt;</title>');
    expect(rss).toContain('<pubDate>Fri, 06 Nov 2026 08:00:00 GMT</pubDate>');
  });
});
