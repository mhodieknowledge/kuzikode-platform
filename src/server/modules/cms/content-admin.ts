/**
 * Admin → Content (P4.22, docs/12 §C): insights (posts, categories, tags, scheduling), industries, FAQ, testimonials
 * (consent enforced here, in the schema and in the database), technologies, and the newsletter subscriber list/export.
 * Every write bumps `content_version` and writes an audit row in the same batch, then resets the in-memory CMS cache.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { toCsv } from '../../lib/csv';
import { conflict, notFound, validationError } from '../../lib/errors';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import type {
  FaqInput,
  IndustryInput,
  NewsletterFilter,
  PostCategoryInput,
  PostInput,
  TechnologyInput,
  TestimonialInput,
} from '../../../shared/schemas/content-admin';
import { bumpContentVersionStmt, resetCmsCache } from './service';

const CAN = 'content.manage';
const bump = (ctx: RequestContext) => bumpContentVersionStmt(ctx.db);
const audit = (
  ctx: RequestContext,
  action: string,
  entityType: string,
  entityId: string,
  after?: Record<string, unknown>,
) => auditStmt(ctx, { action, entityType, entityId, ...(after ? { after } : {}) });

async function exists(ctx: RequestContext, sql: string, ...params: unknown[]): Promise<boolean> {
  return Boolean(
    await ctx.db
      .prepare(sql)
      .bind(...params)
      .first(),
  );
}

async function write(batch: Batch, label = 'save'): Promise<void> {
  const res = await batch.run();
  if (res.changes(label) !== 1) throw notFound();
  resetCmsCache();
}

export const tagSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export const readingMinutes = (html: string) =>
  Math.max(
    1,
    Math.ceil(
      html
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length / 200,
    ),
  );

// ---------------------------------------------------------------- insights

export interface PostAdminRow {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'scheduled' | 'published';
  category_name: string | null;
  author_display_name: string;
  publish_at: string | null;
  published_at: string | null;
  updated_at: string;
}

export async function listPostsAdmin(ctx: RequestContext): Promise<PostAdminRow[]> {
  assertCan(ctx, CAN);
  const { results } = await ctx.db
    .prepare(
      `SELECT p.id, p.slug, p.title, p.status, c.name AS category_name, p.author_display_name, p.publish_at,
         p.published_at, p.updated_at
       FROM posts p LEFT JOIN post_categories c ON c.id = p.category_id
       ORDER BY CASE p.status WHEN 'draft' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
         COALESCE(p.published_at, p.publish_at, p.updated_at) DESC LIMIT 1000`,
    )
    .all<PostAdminRow>();
  return results;
}

export async function getPostAdmin(ctx: RequestContext, id: string) {
  assertCan(ctx, CAN);
  const p = await ctx.db
    .prepare(
      `SELECT id, slug, title, excerpt, body, cover_media_id, category_id, author_display_name, status, publish_at,
         published_at, reading_minutes, seo_title, seo_description, updated_at FROM posts WHERE id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!p) throw notFound();
  const { results } = await ctx.db
    .prepare(
      'SELECT t.name FROM post_tag_links l JOIN post_tags t ON t.id = l.tag_id WHERE l.post_id = ? ORDER BY t.name',
    )
    .bind(id)
    .all<{ name: string }>();
  const out: Record<string, unknown> & { tags: string[] } = { ...p, tags: results.map((t) => t.name) };
  return out;
}

export async function savePost(ctx: RequestContext, id: string | null, input: PostInput): Promise<{ id: string }> {
  assertCan(ctx, CAN);
  const now = ctx.now().toISOString();
  if (await exists(ctx, 'SELECT 1 FROM posts WHERE slug = ? AND id <> ?', input.slug, id ?? ''))
    throw validationError({ slug: ['Another article uses this address.'] });
  if (input.categoryId && !(await exists(ctx, 'SELECT 1 FROM post_categories WHERE id = ?', input.categoryId)))
    throw validationError({ categoryId: ['Choose a category from the list.'] });
  if (input.coverMediaId && !(await exists(ctx, 'SELECT 1 FROM media_assets WHERE id = ?', input.coverMediaId)))
    throw validationError({ coverMediaId: ['Choose an image from the media library.'] });
  if (input.status === 'scheduled' && (!input.publishAt || input.publishAt <= now))
    throw validationError({ publishAt: ['Choose a future date and time to publish.'] });

  const existing = id
    ? await ctx.db
        .prepare('SELECT published_at FROM posts WHERE id = ?')
        .bind(id)
        .first<{ published_at: string | null }>()
    : null;
  if (id && !existing) throw notFound();
  const body = sanitizeHtml(input.body);
  if (!body.replace(/<[^>]+>/g, '').trim()) throw validationError({ body: ['Write the article.'] });
  // A published article keeps its original date when edited or republished.
  const publishedAt = input.status === 'published' ? (existing?.published_at ?? now) : (existing?.published_at ?? null);
  const publishAt = input.status === 'scheduled' ? input.publishAt : null;
  const pid = id ?? newId('pst', ctx.now().getTime());
  const v = [
    input.slug,
    input.title,
    input.excerpt,
    body,
    input.coverMediaId,
    input.categoryId,
    input.authorDisplayName,
    readingMinutes(body),
    input.status,
    publishAt,
    publishedAt,
    input.seoTitle,
    input.seoDescription,
  ];
  const tagMap = new Map<string, string>();
  for (const n of input.tags) if (tagSlug(n).length >= 2 && !tagMap.has(tagSlug(n))) tagMap.set(tagSlug(n), n);
  const tags = [...tagMap.entries()];
  const batch = new Batch(ctx.db).add(
    id
      ? stmt(
          ctx.db,
          `UPDATE posts SET slug = ?, title = ?, excerpt = ?, body = ?, cover_media_id = ?, category_id = ?,
             author_display_name = ?, reading_minutes = ?, status = ?, publish_at = ?, published_at = ?, seo_title = ?,
             seo_description = ?, updated_at = ? WHERE id = ?`,
          ...v,
          now,
          id,
        )
      : stmt(
          ctx.db,
          `INSERT INTO posts (id, slug, title, excerpt, body, cover_media_id, category_id, author_display_name,
             reading_minutes, status, publish_at, published_at, seo_title, seo_description, author_user_id, created_at,
             updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          pid,
          ...v,
          ctx.actor.userId,
          now,
          now,
        ),
    'save',
  );
  batch.add(stmt(ctx.db, 'DELETE FROM post_tag_links WHERE post_id = ?', pid));
  for (const [slug, name] of tags) {
    batch.add(
      stmt(
        ctx.db,
        'INSERT INTO post_tags (id, slug, name) VALUES (?, ?, ?) ON CONFLICT(slug) DO NOTHING',
        newId('ptg', ctx.now().getTime()),
        slug,
        name,
      ),
    );
    batch.add(
      stmt(
        ctx.db,
        'INSERT INTO post_tag_links (post_id, tag_id) SELECT ?, id FROM post_tags WHERE slug = ?',
        pid,
        slug,
      ),
    );
  }
  batch
    .add(bump(ctx))
    .add(audit(ctx, id ? 'post.updated' : 'post.created', 'post', pid, { status: input.status, slug: input.slug }));
  await write(batch);
  return { id: pid };
}

/** Only drafts can be deleted; a published or scheduled article is first moved back to draft. */
export async function deletePost(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, CAN);
  const p = await ctx.db.prepare('SELECT status FROM posts WHERE id = ?').bind(id).first<{ status: string }>();
  if (!p) throw notFound();
  if (p.status !== 'draft') throw conflict('Move the article back to draft before deleting it.');
  await write(
    new Batch(ctx.db)
      .add(stmt(ctx.db, 'DELETE FROM post_tag_links WHERE post_id = ?', id))
      .add(stmt(ctx.db, "DELETE FROM posts WHERE id = ? AND status = 'draft'", id), 'save')
      .add(bump(ctx))
      .add(audit(ctx, 'post.deleted', 'post', id)),
  );
}

export async function listPostCategoriesAdmin(ctx: RequestContext) {
  assertCan(ctx, CAN);
  const { results } = await ctx.db
    .prepare(
      `SELECT c.id, c.slug, c.name, c.sort_order, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id) AS posts
       FROM post_categories c ORDER BY c.sort_order, c.name`,
    )
    .all<{ id: string; slug: string; name: string; sort_order: number; posts: number }>();
  return results;
}

export async function savePostCategory(
  ctx: RequestContext,
  id: string | null,
  input: PostCategoryInput,
): Promise<{ id: string }> {
  assertCan(ctx, CAN);
  if (await exists(ctx, 'SELECT 1 FROM post_categories WHERE slug = ? AND id <> ?', input.slug, id ?? ''))
    throw validationError({ slug: ['Another category uses this address.'] });
  const cid = id ?? newId('pct', ctx.now().getTime());
  await write(
    new Batch(ctx.db)
      .add(
        id
          ? stmt(
              ctx.db,
              'UPDATE post_categories SET slug = ?, name = ?, sort_order = ? WHERE id = ?',
              input.slug,
              input.name,
              input.sortOrder,
              id,
            )
          : stmt(
              ctx.db,
              'INSERT INTO post_categories (id, slug, name, sort_order) VALUES (?, ?, ?, ?)',
              cid,
              input.slug,
              input.name,
              input.sortOrder,
            ),
        'save',
      )
      .add(bump(ctx))
      .add(
        audit(ctx, id ? 'post_category.updated' : 'post_category.created', 'post_category', cid, { name: input.name }),
      ),
  );
  return { id: cid };
}

export async function deletePostCategory(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, CAN);
  if (await exists(ctx, 'SELECT 1 FROM posts WHERE category_id = ?', id))
    throw conflict('Move its articles to another category first.');
  await write(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          'DELETE FROM post_categories WHERE id = ? AND NOT EXISTS (SELECT 1 FROM posts WHERE category_id = ?)',
          id,
          id,
        ),
        'save',
      )
      .add(bump(ctx))
      .add(audit(ctx, 'post_category.deleted', 'post_category', id)),
  );
}

// ---------------------------------------------------------------- industries

export async function listIndustriesAdmin(ctx: RequestContext) {
  assertCan(ctx, CAN);
  const { results } = await ctx.db
    .prepare(
      `SELECT i.id, i.slug, i.name, i.summary, i.status, i.sort_order, i.icon,
         (SELECT COUNT(*) FROM industry_services s WHERE s.industry_id = i.id) AS services
       FROM industries i ORDER BY i.sort_order, i.name`,
    )
    .all<{
      id: string;
      slug: string;
      name: string;
      summary: string;
      status: string;
      sort_order: number;
      icon: string | null;
      services: number;
    }>();
  return results;
}

export async function getIndustryAdmin(ctx: RequestContext, id: string) {
  assertCan(ctx, CAN);
  const i = await ctx.db
    .prepare(
      `SELECT id, slug, name, summary, challenges, body, icon, status, sort_order, seo_title, seo_description
       FROM industries WHERE id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown> & { challenges: string }>();
  if (!i) throw notFound();
  const { results } = await ctx.db
    .prepare('SELECT service_id FROM industry_services WHERE industry_id = ? ORDER BY service_id')
    .bind(id)
    .all<{ service_id: string }>();
  let challenges: unknown = [];
  try {
    challenges = JSON.parse(i.challenges);
  } catch {
    challenges = [];
  }
  const out: Record<string, unknown> & { challenges: unknown; serviceIds: string[] } = {
    ...i,
    challenges,
    serviceIds: results.map((r) => r.service_id),
  };
  return out;
}

export async function saveIndustry(
  ctx: RequestContext,
  id: string | null,
  input: IndustryInput,
): Promise<{ id: string }> {
  assertCan(ctx, CAN);
  if (await exists(ctx, 'SELECT 1 FROM industries WHERE slug = ? AND id <> ?', input.slug, id ?? ''))
    throw validationError({ slug: ['Another industry uses this address.'] });
  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length) {
    const found = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM services WHERE id IN (${serviceIds.map(() => '?').join(', ')})`)
      .bind(...serviceIds)
      .first<{ n: number }>();
    if ((found?.n ?? 0) !== serviceIds.length)
      throw validationError({ serviceIds: ['Choose services from the list.'] });
  }
  const iid = id ?? newId('ind', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const v = [
    input.slug,
    input.name,
    input.summary,
    JSON.stringify(input.challenges),
    input.body ? sanitizeHtml(input.body) : null,
    input.icon,
    input.status,
    input.sortOrder,
    input.seoTitle,
    input.seoDescription,
  ];
  const batch = new Batch(ctx.db).add(
    id
      ? stmt(
          ctx.db,
          `UPDATE industries SET slug = ?, name = ?, summary = ?, challenges = ?, body = ?, icon = ?, status = ?,
             sort_order = ?, seo_title = ?, seo_description = ?, updated_at = ? WHERE id = ?`,
          ...v,
          now,
          id,
        )
      : stmt(
          ctx.db,
          `INSERT INTO industries (id, slug, name, summary, challenges, body, icon, status, sort_order, seo_title,
             seo_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          iid,
          ...v,
          now,
          now,
        ),
    'save',
  );
  batch.add(stmt(ctx.db, 'DELETE FROM industry_services WHERE industry_id = ?', iid));
  for (const s of serviceIds)
    batch.add(stmt(ctx.db, 'INSERT INTO industry_services (industry_id, service_id) VALUES (?, ?)', iid, s));
  batch
    .add(bump(ctx))
    .add(audit(ctx, id ? 'industry.updated' : 'industry.created', 'industry', iid, { status: input.status }));
  await write(batch);
  return { id: iid };
}

export async function deleteIndustry(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, CAN);
  await write(
    new Batch(ctx.db)
      .add(stmt(ctx.db, 'DELETE FROM industry_services WHERE industry_id = ?', id))
      .add(stmt(ctx.db, 'DELETE FROM industries WHERE id = ?', id), 'save')
      .add(bump(ctx))
      .add(audit(ctx, 'industry.deleted', 'industry', id)),
  );
}

// ---------------------------------------------------------------- FAQ

export async function listFaqsAdmin(ctx: RequestContext) {
  assertCan(ctx, CAN);
  const { results } = await ctx.db
    .prepare(
      `SELECT f.id, f.category, f.question, f.answer, f.service_id, s.name AS service_name, f.sort_order, f.published
       FROM faqs f LEFT JOIN services s ON s.id = f.service_id ORDER BY f.category, f.sort_order, f.question`,
    )
    .all<Record<string, unknown>>();
  return results;
}

export async function saveFaq(ctx: RequestContext, id: string | null, input: FaqInput): Promise<{ id: string }> {
  assertCan(ctx, CAN);
  if (input.serviceId && !(await exists(ctx, 'SELECT 1 FROM services WHERE id = ?', input.serviceId)))
    throw validationError({ serviceId: ['Choose a service from the list.'] });
  const fid = id ?? newId('faq', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const v = [input.category, input.question, input.answer, input.serviceId, input.sortOrder, input.published ? 1 : 0];
  await write(
    new Batch(ctx.db)
      .add(
        id
          ? stmt(
              ctx.db,
              'UPDATE faqs SET category = ?, question = ?, answer = ?, service_id = ?, sort_order = ?, published = ?, updated_at = ? WHERE id = ?',
              ...v,
              now,
              id,
            )
          : stmt(
              ctx.db,
              'INSERT INTO faqs (id, category, question, answer, service_id, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              fid,
              ...v,
              now,
              now,
            ),
        'save',
      )
      .add(bump(ctx))
      .add(audit(ctx, id ? 'faq.updated' : 'faq.created', 'faq', fid, { published: input.published })),
  );
  return { id: fid };
}

export async function deleteFaq(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, CAN);
  await write(
    new Batch(ctx.db)
      .add(stmt(ctx.db, 'DELETE FROM faqs WHERE id = ?', id), 'save')
      .add(bump(ctx))
      .add(audit(ctx, 'faq.deleted', 'faq', id)),
  );
}

// ---------------------------------------------------------------- testimonials

export async function listTestimonialsAdmin(ctx: RequestContext) {
  assertCan(ctx, CAN);
  const { results } = await ctx.db
    .prepare(
      `SELECT t.id, t.client_id, c.display_name AS client_name, t.project_id, p.name AS project_name, t.author_name,
         t.author_role, t.quote, t.consent_obtained, t.consent_date, t.published, t.sort_order
       FROM testimonials t JOIN clients c ON c.id = t.client_id LEFT JOIN projects p ON p.id = t.project_id
       ORDER BY t.published DESC, t.sort_order, t.created_at DESC`,
    )
    .all<Record<string, unknown>>();
  return results;
}

/** Clients (and their projects) a testimonial can be linked to. */
export async function testimonialSources(ctx: RequestContext) {
  assertCan(ctx, CAN);
  const [clients, projects] = await Promise.all([
    ctx.db
      .prepare(
        "SELECT id, display_name AS name FROM clients WHERE status <> 'archived' ORDER BY display_name LIMIT 2000",
      )
      .all<{ id: string; name: string }>(),
    ctx.db
      .prepare('SELECT id, client_id, name FROM projects ORDER BY name LIMIT 5000')
      .all<{ id: string; client_id: string; name: string }>(),
  ]);
  return { clients: clients.results, projects: projects.results };
}

export async function saveTestimonial(
  ctx: RequestContext,
  id: string | null,
  input: TestimonialInput,
): Promise<{ id: string }> {
  assertCan(ctx, CAN);
  // Defence in depth: the schema and a CHECK constraint enforce this too.
  if (input.consentObtained !== true) throw validationError({ consentObtained: ['Record the client’s consent.'] });
  const today = ctx.now().toISOString().slice(0, 10);
  if (input.consentDate > today) throw validationError({ consentDate: ['Consent can’t be dated in the future.'] });
  if (!(await exists(ctx, 'SELECT 1 FROM clients WHERE id = ?', input.clientId)))
    throw validationError({ clientId: ['Choose the client this testimonial came from.'] });
  if (
    input.projectId &&
    !(await exists(ctx, 'SELECT 1 FROM projects WHERE id = ? AND client_id = ?', input.projectId, input.clientId))
  )
    throw validationError({ projectId: ['Choose one of this client’s projects.'] });
  const tid = id ?? newId('tst', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const v = [
    input.clientId,
    input.projectId,
    input.authorName,
    input.authorRole,
    input.quote,
    input.consentDate,
    input.published ? 1 : 0,
    input.sortOrder,
  ];
  await write(
    new Batch(ctx.db)
      .add(
        id
          ? stmt(
              ctx.db,
              `UPDATE testimonials SET client_id = ?, project_id = ?, author_name = ?, author_role = ?, quote = ?,
                 consent_obtained = 1, consent_date = ?, published = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
              ...v,
              now,
              id,
            )
          : stmt(
              ctx.db,
              `INSERT INTO testimonials (id, client_id, project_id, author_name, author_role, quote, consent_obtained,
                 consent_date, published, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
              tid,
              ...v,
              now,
              now,
            ),
        'save',
      )
      .add(bump(ctx))
      .add(
        audit(ctx, id ? 'testimonial.updated' : 'testimonial.created', 'testimonial', tid, {
          clientId: input.clientId,
          consentDate: input.consentDate,
          published: input.published,
        }),
      ),
  );
  return { id: tid };
}

export async function deleteTestimonial(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, CAN);
  await write(
    new Batch(ctx.db)
      .add(stmt(ctx.db, 'DELETE FROM testimonials WHERE id = ?', id), 'save')
      .add(bump(ctx))
      .add(audit(ctx, 'testimonial.deleted', 'testimonial', id)),
  );
}

// ---------------------------------------------------------------- technologies

export async function listTechnologiesAdmin(ctx: RequestContext) {
  assertCan(ctx, CAN);
  const { results } = await ctx.db
    .prepare(
      'SELECT id, name, category, logo_svg_path, sort_order, published FROM technologies ORDER BY sort_order, name',
    )
    .all<Record<string, unknown>>();
  return results;
}

export async function saveTechnology(
  ctx: RequestContext,
  id: string | null,
  input: TechnologyInput,
): Promise<{ id: string }> {
  assertCan(ctx, CAN);
  if (await exists(ctx, 'SELECT 1 FROM technologies WHERE lower(name) = lower(?) AND id <> ?', input.name, id ?? ''))
    throw validationError({ name: ['This technology is already listed.'] });
  const tid = id ?? newId('tec', ctx.now().getTime());
  const v = [input.name, input.category, input.logoSvgPath, input.sortOrder, input.published ? 1 : 0];
  await write(
    new Batch(ctx.db)
      .add(
        id
          ? stmt(
              ctx.db,
              'UPDATE technologies SET name = ?, category = ?, logo_svg_path = ?, sort_order = ?, published = ? WHERE id = ?',
              ...v,
              id,
            )
          : stmt(
              ctx.db,
              'INSERT INTO technologies (id, name, category, logo_svg_path, sort_order, published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              tid,
              ...v,
              ctx.now().toISOString(),
            ),
        'save',
      )
      .add(bump(ctx))
      .add(audit(ctx, id ? 'technology.updated' : 'technology.created', 'technology', tid, { name: input.name })),
  );
  return { id: tid };
}

export async function deleteTechnology(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, CAN);
  await write(
    new Batch(ctx.db)
      .add(stmt(ctx.db, 'DELETE FROM technologies WHERE id = ?', id), 'save')
      .add(bump(ctx))
      .add(audit(ctx, 'technology.deleted', 'technology', id)),
  );
}

// ---------------------------------------------------------------- newsletter

export const NEWSLETTER_PAGE_SIZE = 50;

function newsletterWhere(f: Pick<NewsletterFilter, 'status' | 'q'>) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status) {
    where.push('status = ?');
    params.push(f.status);
  }
  if (f.q) {
    where.push("email LIKE ? ESCAPE '\\'");
    params.push(`%${f.q.toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Subscriber list (no IP hashes or tokens leave the database). */
export async function listSubscribers(ctx: RequestContext, f: NewsletterFilter) {
  assertCan(ctx, 'newsletter.view');
  const w = newsletterWhere(f);
  const [rows, counts] = await Promise.all([
    ctx.db
      .prepare(
        `SELECT id, email, status, source, confirmed_at, unsubscribed_at, created_at FROM newsletter_subscribers ${w.sql}
         ORDER BY created_at DESC, id LIMIT ? OFFSET ?`,
      )
      .bind(...w.params, NEWSLETTER_PAGE_SIZE + 1, (f.page - 1) * NEWSLETTER_PAGE_SIZE)
      .all<{
        id: string;
        email: string;
        status: string;
        source: string | null;
        confirmed_at: string | null;
        unsubscribed_at: string | null;
        created_at: string;
      }>(),
    ctx.db
      .prepare('SELECT status, COUNT(*) AS n FROM newsletter_subscribers GROUP BY status')
      .all<{ status: string; n: number }>(),
  ]);
  return {
    items: rows.results.slice(0, NEWSLETTER_PAGE_SIZE),
    hasMore: rows.results.length > NEWSLETTER_PAGE_SIZE,
    counts: Object.fromEntries(counts.results.map((c) => [c.status, c.n])) as Record<string, number>,
  };
}

/**
 * CSV of subscribers. Defaults to confirmed subscribers only (the only people who agreed to receive email); the
 * export itself is audited with its filter and row count, never the addresses.
 */
export async function exportSubscribersCsv(
  ctx: RequestContext,
  f: Pick<NewsletterFilter, 'status' | 'q'>,
): Promise<string> {
  assertCan(ctx, 'newsletter.export');
  const filter = { status: f.status ?? ('confirmed' as const), q: f.q };
  const w = newsletterWhere(filter);
  const { results } = await ctx.db
    .prepare(
      `SELECT email, status, source, confirmed_at, unsubscribed_at, created_at FROM newsletter_subscribers ${w.sql}
       ORDER BY created_at, id LIMIT 50000`,
    )
    .bind(...w.params)
    .all<Record<string, string | null>>();
  await auditStmt(ctx, {
    action: 'newsletter.exported',
    entityType: 'newsletter',
    entityId: 'subscribers',
    after: { status: filter.status, q: filter.q ?? null, rows: results.length },
  }).run();
  return toCsv([
    ['Email', 'Status', 'Source', 'Confirmed at', 'Unsubscribed at', 'Signed up at'],
    ...results.map((r) => [r.email, r.status, r.source, r.confirmed_at, r.unsubscribed_at, r.created_at]),
  ]);
}

/** Services grouped by division, for the industry and FAQ pickers. */
export async function serviceOptions(ctx: RequestContext) {
  assertCan(ctx, CAN);
  const { results } = await ctx.db
    .prepare(
      `SELECT s.id, s.name, c.name AS division FROM services s JOIN service_categories c ON c.id = s.category_id
       ORDER BY c.sort_order, c.name, s.sort_order, s.name`,
    )
    .all<{ id: string; name: string; division: string }>();
  return results;
}
