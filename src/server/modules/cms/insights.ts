/**
 * Insights blog (docs/12 §C.4): published posts, categories, tags, related posts, RSS, Article JSON-LD and scheduled
 * publishing. Reads are cached by content_version; the 5-minute cron publishes due posts and bumps the version.
 */
import type { RequestContext } from '../../context';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { cached, resetCmsCache } from './service';

export const POSTS_PER_PAGE = 12;

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: { slug: string; name: string } | null;
  tags: { slug: string; name: string }[];
  author: string;
  readingMinutes: number;
  publishedAt: string;
  updatedAt: string;
  cover: { src: string; alt: string; width: number | null; height: number | null } | null;
}

export interface PostDetail extends PostSummary {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  author_display_name: string;
  reading_minutes: number;
  published_at: string;
  updated_at: string;
  seo_title: string | null;
  seo_description: string | null;
  category_slug: string | null;
  category_name: string | null;
  tags: string;
  cover_file_id: string | null;
  cover_alt: string | null;
  cover_width: number | null;
  cover_height: number | null;
}

const SELECT = `SELECT p.id, p.slug, p.title, p.excerpt, p.author_display_name, p.reading_minutes, p.published_at, p.updated_at,
    p.seo_title, p.seo_description, c.slug AS category_slug, c.name AS category_name,
    (SELECT json_group_array(json_object('slug', t.slug, 'name', t.name))
       FROM post_tag_links l JOIN post_tags t ON t.id = l.tag_id WHERE l.post_id = p.id) AS tags,
    f.id AS cover_file_id, m.alt_text AS cover_alt, m.width AS cover_width, m.height AS cover_height`;
const FROM = `FROM posts p
  LEFT JOIN post_categories c ON c.id = p.category_id
  LEFT JOIN media_assets m ON m.id = p.cover_media_id
  LEFT JOIN files f ON f.id = m.file_id AND f.visibility = 'public'
  WHERE p.status = 'published' AND p.published_at IS NOT NULL`;

function toSummary(r: PostRow): PostSummary {
  let tags: { slug: string; name: string }[] = [];
  try {
    tags = (JSON.parse(r.tags) as { slug: string; name: string }[]).filter((t) => t && t.slug);
  } catch {
    tags = [];
  }
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    category: r.category_slug ? { slug: r.category_slug, name: r.category_name ?? r.category_slug } : null,
    tags: tags.sort((a, b) => a.name.localeCompare(b.name)),
    author: r.author_display_name,
    readingMinutes: r.reading_minutes,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    cover: r.cover_file_id
      ? { src: `/media/${r.cover_file_id}`, alt: r.cover_alt ?? '', width: r.cover_width, height: r.cover_height }
      : null,
  };
}

/** All published posts, newest first (metadata only). */
export function listPosts(ctx: RequestContext): Promise<PostSummary[]> {
  return cached(ctx, 'posts', async () => {
    const { results } = await ctx.db
      .prepare(`${SELECT} ${FROM} ORDER BY p.published_at DESC, p.slug LIMIT 1000`)
      .all<PostRow>();
    return results.map(toSummary);
  });
}

export function listPostCategories(ctx: RequestContext) {
  return cached(ctx, 'post-categories', async () => {
    const { results } = await ctx.db
      .prepare(
        `SELECT c.slug, c.name, COUNT(p.id) AS count FROM post_categories c
         LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'published'
         GROUP BY c.id ORDER BY c.sort_order, c.name`,
      )
      .all<{ slug: string; name: string; count: number }>();
    return results;
  });
}

export function listPostTags(ctx: RequestContext) {
  return cached(ctx, 'post-tags', async () => {
    const { results } = await ctx.db
      .prepare('SELECT slug, name FROM post_tags ORDER BY name')
      .all<{ slug: string; name: string }>();
    return results;
  });
}

export interface PostFilter {
  category?: string | undefined;
  tag?: string | undefined;
  page?: number | undefined;
}

export async function findPosts(ctx: RequestContext, filter: PostFilter = {}) {
  const all = await listPosts(ctx);
  const matching = all.filter(
    (p) =>
      (!filter.category || p.category?.slug === filter.category) &&
      (!filter.tag || p.tags.some((t) => t.slug === filter.tag)),
  );
  const pages = Math.max(1, Math.ceil(matching.length / POSTS_PER_PAGE));
  const page = Math.min(Math.max(1, Math.floor(filter.page ?? 1)), pages);
  return {
    posts: matching.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE),
    page,
    pages,
    total: matching.length,
  };
}

export function getPost(ctx: RequestContext, slug: string): Promise<PostDetail | null> {
  return cached(ctx, `post:${slug}`, async () => {
    const row = await ctx.db.prepare(`${SELECT}, p.body ${FROM} AND p.slug = ?`).bind(slug).first<PostRow>();
    if (!row) return null;
    return {
      ...toSummary(row),
      body: sanitizeHtml(row.body ?? ''),
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
    };
  });
}

/** Up to `limit` other posts: same category first, then shared tags, then newest. */
export async function relatedPosts(ctx: RequestContext, post: PostSummary, limit = 3): Promise<PostSummary[]> {
  const score = (p: PostSummary) =>
    (p.category && p.category.slug === post.category?.slug ? 100 : 0) +
    p.tags.filter((t) => post.tags.some((x) => x.slug === t.slug)).length;
  return (await listPosts(ctx))
    .filter((p) => p.slug !== post.slug)
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * Publishes scheduled posts whose time has come. The content_version bump is conditional on there being due posts and
 * runs in the same batch, so caches only turn over when something actually changed.
 */
export async function publishDuePosts(ctx: RequestContext): Promise<number> {
  const now = ctx.now().toISOString();
  const due = "status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?";
  const [bump, update] = await ctx.db.batch([
    ctx.db
      .prepare(
        `UPDATE application_settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ?
         WHERE key = 'content_version' AND EXISTS (SELECT 1 FROM posts WHERE ${due})`,
      )
      .bind(now, now),
    ctx.db
      .prepare(`UPDATE posts SET status = 'published', published_at = publish_at, updated_at = ? WHERE ${due}`)
      .bind(now, now),
  ]);
  const changed = update?.meta.changes ?? 0;
  if (changed > 0 && (bump?.meta.changes ?? 0) > 0) resetCmsCache();
  return changed;
}

const abs = (ctx: RequestContext, path: string) => new URL(path, ctx.config.siteUrl).toString();

export function articleLd(ctx: RequestContext, post: PostDetail): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription ?? post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt > post.publishedAt ? post.updatedAt : post.publishedAt,
    author: { '@type': 'Organization', name: post.author, url: abs(ctx, '/') },
    publisher: { '@id': abs(ctx, '/#organization') },
    mainEntityOfPage: abs(ctx, `/insights/${post.slug}`),
    ...(post.cover ? { image: abs(ctx, post.cover.src) } : {}),
    ...(post.category ? { articleSection: post.category.name } : {}),
    ...(post.tags.length ? { keywords: post.tags.map((t) => t.name).join(', ') } : {}),
  };
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** RSS 2.0 feed of the latest 20 posts. */
export function renderRss(ctx: RequestContext, posts: PostSummary[]): string {
  const latest = posts.slice(0, 20);
  const items = latest
    .map((p) => {
      const link = abs(ctx, `/insights/${p.slug}`);
      return [
        '    <item>',
        `      <title>${xml(p.title)}</title>`,
        `      <link>${xml(link)}</link>`,
        `      <guid isPermaLink="true">${xml(link)}</guid>`,
        `      <description>${xml(p.excerpt)}</description>`,
        `      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>`,
        ...(p.category ? [`      <category>${xml(p.category.name)}</category>`] : []),
        '    </item>',
      ].join('\n');
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Kuzikode Technologies · Insights</title>
    <link>${xml(abs(ctx, '/insights'))}</link>
    <description>Practical guides on websites, online payments, business email and software.</description>
    <language>en</language>
    <atom:link href="${xml(abs(ctx, '/insights/rss.xml'))}" rel="self" type="application/rss+xml" />
${latest[0] ? `    <lastBuildDate>${new Date(latest[0].publishedAt).toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
}
