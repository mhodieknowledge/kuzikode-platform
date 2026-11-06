/**
 * CMS editors (P4.15). Page sections are edited as drafts (`draft_content`), previewed on the real public page with
 * `?preview=1` (staff with `cms.manage` only, never cached) and published together, which copies drafts to
 * `published_content` and bumps `content_version` so every cache misses. Structural switches (section visibility and
 * order, page titles/SEO, portfolio/product/announcement publishing) apply when saved and bump the version too.
 * Media assets always carry alt text (enforced by the database as well).
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { conflict, notFound, validationError } from '../../lib/errors';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { newId } from '../../lib/ids';
import { assertCan, can } from '../../lib/policies';
import { SECTION_SCHEMAS, type SectionType } from '../../../shared/schemas/cms';
import { storeUpload } from '../files/service';
import { bumpContentVersionStmt, resetCmsCache } from './service';

const bump = (ctx: RequestContext) => bumpContentVersionStmt(ctx.db);
const audit = (
  ctx: RequestContext,
  action: string,
  entityType: string,
  entityId: string,
  after?: Record<string, unknown>,
) => auditStmt(ctx, { action, entityType, entityId, ...(after ? { after } : {}) });
const done = () => resetCmsCache();

const fieldsFrom = (issues: { path: PropertyKey[]; message: string }[], prefix = '') => {
  const fields: Record<string, string[]> = {};
  for (const i of issues) (fields[`${prefix}${i.path.map(String).join('.')}` || 'content'] ??= []).push(i.message);
  return fields;
};

// ---------------------------------------------------------------- pages & sections

export async function listPages(ctx: RequestContext) {
  assertCan(ctx, 'cms.manage');
  const { results } = await ctx.db
    .prepare(
      `SELECT p.key, p.title, p.status, p.published_at, p.updated_at,
         (SELECT COUNT(*) FROM website_sections s WHERE s.page_id = p.id) AS sections,
         EXISTS (SELECT 1 FROM website_sections s WHERE s.page_id = p.id
                 AND (s.published_content IS NULL OR s.draft_content <> s.published_content)) AS has_changes
       FROM website_pages p ORDER BY CASE WHEN p.key LIKE 'legal-%' THEN 1 ELSE 0 END, p.key`,
    )
    .all<{
      key: string;
      title: string;
      status: string;
      published_at: string | null;
      updated_at: string;
      sections: number;
      has_changes: number;
    }>();
  return results;
}

interface SectionAdminRow {
  id: string;
  key: string;
  type: SectionType;
  position: number;
  visible: number;
  draft_content: string;
  published_content: string | null;
  updated_at: string;
}

export async function getPageAdmin(ctx: RequestContext, key: string) {
  assertCan(ctx, 'cms.manage');
  const page = await ctx.db.prepare('SELECT * FROM website_pages WHERE key = ?').bind(key).first<{
    id: string;
    key: string;
    title: string;
    seo_title: string | null;
    seo_description: string | null;
    og_image_id: string | null;
    status: string;
    published_at: string | null;
  }>();
  if (!page) throw notFound();
  const { results } = await ctx.db
    .prepare('SELECT * FROM website_sections WHERE page_id = ? ORDER BY position, key')
    .bind(page.id)
    .all<SectionAdminRow>();
  const parse = (v: string | null) => {
    try {
      return v ? (JSON.parse(v) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return {
    page,
    sections: results.map((s) => ({
      key: s.key,
      type: s.type,
      position: s.position,
      visible: s.visible === 1,
      draft: parse(s.draft_content) ?? {},
      changed: s.published_content === null || s.draft_content !== s.published_content,
      updatedAt: s.updated_at,
    })),
  };
}

async function pageId(ctx: RequestContext, key: string): Promise<string> {
  const p = await ctx.db.prepare('SELECT id FROM website_pages WHERE key = ?').bind(key).first<{ id: string }>();
  if (!p) throw notFound();
  return p.id;
}

export async function savePageMeta(
  ctx: RequestContext,
  key: string,
  input: { title: string; seoTitle: string | null; seoDescription: string | null; ogImageId: string | null },
) {
  assertCan(ctx, 'cms.manage');
  const id = await pageId(ctx, key);
  if (input.ogImageId) await assertMedia(ctx, input.ogImageId, 'ogImageId');
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE website_pages SET title = ?, seo_title = ?, seo_description = ?, og_image_id = ?, updated_by = ?, updated_at = ? WHERE id = ?',
        input.title,
        input.seoTitle,
        input.seoDescription,
        input.ogImageId,
        ctx.actor.userId,
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(bump(ctx))
    .add(audit(ctx, 'cms.page_meta_saved', 'website_page', key, { title: input.title }))
    .run();
  done();
}

/** Saves a section's draft after validating it against its type's schema (rich text is sanitised on save). */
export async function saveSectionDraft(ctx: RequestContext, pageKey: string, sectionKey: string, content: unknown) {
  assertCan(ctx, 'cms.manage');
  const id = await pageId(ctx, pageKey);
  const s = await ctx.db
    .prepare('SELECT id, type FROM website_sections WHERE page_id = ? AND key = ?')
    .bind(id, sectionKey)
    .first<{ id: string; type: SectionType }>();
  if (!s) throw notFound();
  const schema = SECTION_SCHEMAS[s.type];
  const parsed = schema.safeParse(content);
  if (!parsed.success) throw validationError(fieldsFrom(parsed.error.issues));
  const value = parsed.data as Record<string, unknown>;
  if (s.type === 'rich_text') value['html'] = sanitizeHtml(String(value['html'] ?? ''));
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE website_sections SET draft_content = ?, updated_at = ? WHERE id = ?',
        JSON.stringify(value),
        ctx.now().toISOString(),
        s.id,
      ),
    )
    .add(audit(ctx, 'cms.section_draft_saved', 'website_page', pageKey, { section: sectionKey }))
    .run();
}

export async function setSectionVisible(ctx: RequestContext, pageKey: string, sectionKey: string, visible: boolean) {
  assertCan(ctx, 'cms.manage');
  const id = await pageId(ctx, pageKey);
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE website_sections SET visible = ?, updated_at = ? WHERE page_id = ? AND key = ?',
        visible ? 1 : 0,
        ctx.now().toISOString(),
        id,
        sectionKey,
      ),
      'section',
    )
    .add(bump(ctx))
    .add(audit(ctx, 'cms.section_visibility', 'website_page', pageKey, { section: sectionKey, visible }))
    .run();
  if (res.changes('section') !== 1) throw notFound();
  done();
}

/** Moves a section one place up or down (positions are renumbered 0..n-1 in the same batch). */
export async function moveSection(ctx: RequestContext, pageKey: string, sectionKey: string, direction: 'up' | 'down') {
  assertCan(ctx, 'cms.manage');
  const id = await pageId(ctx, pageKey);
  const { results } = await ctx.db
    .prepare('SELECT key FROM website_sections WHERE page_id = ? ORDER BY position, key')
    .bind(id)
    .all<{ key: string }>();
  const keys = results.map((r) => r.key);
  const i = keys.indexOf(sectionKey);
  if (i < 0) throw notFound();
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j]!, keys[i]!];
  await new Batch(ctx.db)
    .addAll(
      keys.map((k, pos) =>
        stmt(ctx.db, 'UPDATE website_sections SET position = ? WHERE page_id = ? AND key = ?', pos, id, k),
      ),
    )
    .add(bump(ctx))
    .add(audit(ctx, 'cms.section_moved', 'website_page', pageKey, { section: sectionKey, direction }))
    .run();
  done();
}

/** Publishes every section draft of the page at once and bumps the content version. */
export async function publishPage(ctx: RequestContext, key: string) {
  assertCan(ctx, 'cms.manage');
  const id = await pageId(ctx, key);
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE website_sections SET published_content = draft_content, published_at = ?
         WHERE page_id = ? AND (published_content IS NULL OR published_content <> draft_content)`,
        now,
        id,
      ),
    )
    .add(
      stmt(
        ctx.db,
        "UPDATE website_pages SET status = 'published', published_at = ?, body_published = body_draft, updated_by = ?, updated_at = ? WHERE id = ?",
        now,
        ctx.actor.userId,
        now,
        id,
      ),
    )
    .add(bump(ctx))
    .add(audit(ctx, 'cms.page_published', 'website_page', key))
    .run();
  done();
}

/** Throws away unpublished section edits. */
export async function discardChanges(ctx: RequestContext, key: string) {
  assertCan(ctx, 'cms.manage');
  const id = await pageId(ctx, key);
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE website_sections SET draft_content = published_content, updated_at = ? WHERE page_id = ? AND published_content IS NOT NULL',
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(audit(ctx, 'cms.changes_discarded', 'website_page', key))
    .run();
}

// ---------------------------------------------------------------- media library

export interface MediaRow {
  id: string;
  file_id: string;
  alt_text: string;
  caption: string | null;
  folder: string | null;
  width: number | null;
  height: number | null;
  original_name: string;
  size_bytes: number;
  created_at: string;
}

async function assertMedia(ctx: RequestContext, id: string, field: string) {
  const m = await ctx.db.prepare('SELECT id FROM media_assets WHERE id = ?').bind(id).first();
  if (!m) throw validationError({ [field]: ['Choose an image from the media library.'] });
}

export async function listMedia(ctx: RequestContext, q?: string) {
  if (!can(ctx, 'media.manage') && !can(ctx, 'cms.manage')) assertCan(ctx, 'media.manage');
  const like = q?.trim()
    ? `%${q
        .trim()
        .slice(0, 80)
        .replace(/[\\%_]/g, (m) => `\\${m}`)}%`
    : null;
  const { results } = await ctx.db
    .prepare(
      `SELECT m.id, m.file_id, m.alt_text, m.caption, m.folder, m.width, m.height, f.original_name, f.size_bytes, m.created_at
       FROM media_assets m JOIN files f ON f.id = m.file_id
       ${like ? "WHERE m.alt_text LIKE ?1 ESCAPE '\\' OR f.original_name LIKE ?1 ESCAPE '\\' OR m.caption LIKE ?1 ESCAPE '\\'" : ''}
       ORDER BY m.created_at DESC LIMIT 500`,
    )
    .bind(...(like ? [like] : []))
    .all<MediaRow>();
  return results;
}

export async function uploadMedia(
  ctx: RequestContext,
  file: { bytes: Uint8Array<ArrayBuffer>; filename: string },
  meta: { altText: string; caption: string | null; folder: string | null },
): Promise<{ id: string; fileId: string }> {
  assertCan(ctx, 'media.manage');
  if (!meta.altText.trim()) throw validationError({ altText: ['Describe the image for people who cannot see it.'] });
  const stored = await storeUpload(ctx, {
    bytes: file.bytes,
    filename: file.filename,
    purpose: 'image',
    ownerType: 'media',
    ownerId: null,
    visibility: 'public',
  });
  const id = newId('med', ctx.now().getTime());
  await new Batch(ctx.db)
    .add(stored.stmt)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO media_assets (id, file_id, alt_text, width, height, caption, folder) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        stored.id,
        meta.altText.trim(),
        stored.width,
        stored.height,
        meta.caption,
        meta.folder,
      ),
    )
    .add(stmt(ctx.db, "UPDATE files SET owner_id = ? WHERE id = ? AND owner_type = 'media'", id, stored.id))
    .add(audit(ctx, 'media.uploaded', 'media_asset', id, { name: stored.name }))
    .run();
  return { id, fileId: stored.id };
}

export async function updateMedia(
  ctx: RequestContext,
  id: string,
  meta: { altText: string; caption: string | null; folder: string | null },
) {
  assertCan(ctx, 'media.manage');
  if (!meta.altText.trim()) throw validationError({ altText: ['Alt text is required.'] });
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE media_assets SET alt_text = ?, caption = ?, folder = ?, updated_at = ? WHERE id = ?',
        meta.altText.trim(),
        meta.caption,
        meta.folder,
        ctx.now().toISOString(),
        id,
      ),
      'media',
    )
    .add(bump(ctx))
    .add(audit(ctx, 'media.updated', 'media_asset', id))
    .run();
  if (res.changes('media') !== 1) throw notFound();
  done();
}

/** Media still referenced by content can't be deleted. */
export async function deleteMedia(ctx: RequestContext, id: string) {
  assertCan(ctx, 'media.manage');
  const m = await ctx.db
    .prepare('SELECT m.file_id, f.r2_key FROM media_assets m JOIN files f ON f.id = m.file_id WHERE m.id = ?')
    .bind(id)
    .first<{ file_id: string; r2_key: string }>();
  if (!m) throw notFound();
  const used = await ctx.db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM portfolio_projects WHERE cover_media_id = ?1)
        + (SELECT COUNT(*) FROM portfolio_media WHERE media_id = ?1)
        + (SELECT COUNT(*) FROM website_pages WHERE og_image_id = ?1)
        + (SELECT COUNT(*) FROM team_members WHERE photo_media_id = ?1) AS n`,
    )
    .bind(id)
    .first<{ n: number }>();
  if ((used?.n ?? 0) > 0) throw conflict('This image is used on the website. Replace it there first.');
  await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM media_assets WHERE id = ?', id))
    .add(stmt(ctx.db, 'DELETE FROM files WHERE id = ?', m.file_id))
    .add(audit(ctx, 'media.deleted', 'media_asset', id))
    .run();
  await ctx.env.FILES.delete(m.r2_key);
}

// ---------------------------------------------------------------- portfolio

export interface PortfolioInput {
  slug: string;
  name: string;
  clientName: string | null;
  showClientName: boolean;
  category: string;
  summary: string;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  technologies: string[];
  completionDate: string | null;
  externalUrl: string | null;
  coverMediaId: string | null;
  galleryMediaIds: string[];
  featured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export async function listPortfolioAdmin(ctx: RequestContext) {
  assertCan(ctx, 'cms.manage');
  const { results } = await ctx.db
    .prepare(
      'SELECT id, slug, name, category, status, featured, sort_order, updated_at FROM portfolio_projects ORDER BY status, sort_order, name',
    )
    .all<{
      id: string;
      slug: string;
      name: string;
      category: string;
      status: string;
      featured: number;
      sort_order: number;
      updated_at: string;
    }>();
  return results;
}

export async function getPortfolioAdmin(ctx: RequestContext, id: string) {
  assertCan(ctx, 'cms.manage');
  const p = await ctx.db
    .prepare('SELECT * FROM portfolio_projects WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!p) throw notFound();
  const { results } = await ctx.db
    .prepare('SELECT media_id FROM portfolio_media WHERE portfolio_id = ? ORDER BY position')
    .bind(id)
    .all<{ media_id: string }>();
  return { item: p, gallery: results.map((r) => r.media_id) };
}

async function checkPortfolio(ctx: RequestContext, id: string | null, input: PortfolioInput) {
  const dupe = await ctx.db
    .prepare('SELECT id FROM portfolio_projects WHERE slug = ? AND id <> ?')
    .bind(input.slug, id ?? '')
    .first();
  if (dupe) throw validationError({ slug: ['Another case study uses this address.'] });
  for (const m of [...(input.coverMediaId ? [input.coverMediaId] : []), ...input.galleryMediaIds])
    await assertMedia(ctx, m, 'coverMediaId');
}

function portfolioValues(input: PortfolioInput) {
  return [
    input.slug,
    input.name,
    input.clientName,
    input.showClientName ? 1 : 0,
    input.category,
    input.summary,
    input.description ? sanitizeHtml(input.description) : null,
    input.challenge ? sanitizeHtml(input.challenge) : null,
    input.solution ? sanitizeHtml(input.solution) : null,
    JSON.stringify(input.technologies),
    input.completionDate,
    input.externalUrl,
    input.coverMediaId,
    input.featured ? 1 : 0,
    input.sortOrder,
    input.seoTitle,
    input.seoDescription,
  ];
}

const galleryStmts = (ctx: RequestContext, id: string, media: string[]) => [
  stmt(ctx.db, 'DELETE FROM portfolio_media WHERE portfolio_id = ?', id),
  ...[...new Set(media)].map((m, i) =>
    stmt(ctx.db, 'INSERT INTO portfolio_media (portfolio_id, media_id, position) VALUES (?, ?, ?)', id, m, i),
  ),
];

export async function savePortfolio(
  ctx: RequestContext,
  id: string | null,
  input: PortfolioInput,
): Promise<{ id: string }> {
  assertCan(ctx, 'cms.manage');
  await checkPortfolio(ctx, id, input);
  const pid = id ?? newId('pfo', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const cols = `slug, name, client_name, show_client_name, category, summary, description, challenge, solution, technologies,
    completion_date, external_url, cover_media_id, featured, sort_order, seo_title, seo_description`;
  const res = await new Batch(ctx.db)
    .add(
      id
        ? stmt(
            ctx.db,
            `UPDATE portfolio_projects SET ${cols
              .split(',')
              .map((c) => `${c.trim()} = ?`)
              .join(', ')}, updated_at = ? WHERE id = ?`,
            ...portfolioValues(input),
            now,
            id,
          )
        : stmt(
            ctx.db,
            `INSERT INTO portfolio_projects (id, ${cols}, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
            pid,
            ...portfolioValues(input),
            now,
            now,
          ),
      'save',
    )
    .addAll(galleryStmts(ctx, pid, input.galleryMediaIds))
    .add(bump(ctx))
    .add(audit(ctx, id ? 'portfolio.updated' : 'portfolio.created', 'portfolio_project', pid, { slug: input.slug }))
    .run();
  if (res.changes('save') !== 1) throw notFound();
  done();
  return { id: pid };
}

export async function setPortfolioStatus(ctx: RequestContext, id: string, status: 'draft' | 'published') {
  assertCan(ctx, 'cms.manage');
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        "UPDATE portfolio_projects SET status = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END, updated_at = ? WHERE id = ?",
        status,
        status,
        ctx.now().toISOString(),
        ctx.now().toISOString(),
        id,
      ),
      'save',
    )
    .add(bump(ctx))
    .add(audit(ctx, status === 'published' ? 'portfolio.published' : 'portfolio.unpublished', 'portfolio_project', id))
    .run();
  if (res.changes('save') !== 1) throw notFound();
  done();
}

/** Only unpublished case studies can be deleted. */
export async function deletePortfolio(ctx: RequestContext, id: string) {
  assertCan(ctx, 'cms.manage');
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        "DELETE FROM portfolio_media WHERE portfolio_id = ? AND EXISTS (SELECT 1 FROM portfolio_projects WHERE id = ? AND status = 'draft')",
        id,
        id,
      ),
    )
    .add(stmt(ctx.db, "DELETE FROM portfolio_projects WHERE id = ? AND status = 'draft'", id), 'delete')
    .add(audit(ctx, 'portfolio.deleted', 'portfolio_project', id))
    .run();
  if (res.changes('delete') !== 1) throw conflict('Unpublish the case study before deleting it.');
}

// ---------------------------------------------------------------- products & announcements

export interface ProductInput {
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  status: 'in_development' | 'beta' | 'available';
  interestFormEnabled: boolean;
  sortOrder: number;
  published: boolean;
}

export async function listProductsAdmin(ctx: RequestContext) {
  assertCan(ctx, 'cms.manage');
  return (await ctx.db.prepare('SELECT * FROM products ORDER BY sort_order, name').all<Record<string, unknown>>())
    .results;
}

export async function saveProduct(
  ctx: RequestContext,
  id: string | null,
  input: ProductInput,
): Promise<{ id: string }> {
  assertCan(ctx, 'cms.manage');
  const dupe = await ctx.db
    .prepare('SELECT id FROM products WHERE slug = ? AND id <> ?')
    .bind(input.slug, id ?? '')
    .first();
  if (dupe) throw validationError({ slug: ['Another product uses this address.'] });
  const pid = id ?? newId('prd', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const v = [
    input.slug,
    input.name,
    input.tagline,
    input.description,
    input.status,
    input.interestFormEnabled ? 1 : 0,
    input.sortOrder,
    input.published ? 1 : 0,
  ];
  const res = await new Batch(ctx.db)
    .add(
      id
        ? stmt(
            ctx.db,
            'UPDATE products SET slug = ?, name = ?, tagline = ?, description = ?, status = ?, interest_form_enabled = ?, sort_order = ?, published = ?, updated_at = ? WHERE id = ?',
            ...v,
            now,
            id,
          )
        : stmt(
            ctx.db,
            'INSERT INTO products (id, slug, name, tagline, description, status, interest_form_enabled, sort_order, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            pid,
            ...v,
            now,
            now,
          ),
      'save',
    )
    .add(bump(ctx))
    .add(audit(ctx, id ? 'product.updated' : 'product.created', 'product', pid, { published: input.published }))
    .run();
  if (res.changes('save') !== 1) throw notFound();
  done();
  return { id: pid };
}

export interface AnnouncementInput {
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  level: 'info' | 'important';
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
}

export async function listAnnouncementsAdmin(ctx: RequestContext) {
  assertCan(ctx, 'cms.manage');
  return (
    await ctx.db
      .prepare('SELECT * FROM announcements ORDER BY active DESC, created_at DESC')
      .all<Record<string, unknown>>()
  ).results;
}

export async function saveAnnouncement(
  ctx: RequestContext,
  id: string | null,
  input: AnnouncementInput,
): Promise<{ id: string }> {
  assertCan(ctx, 'cms.manage');
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt)
    throw validationError({ endsAt: ['The end must be after the start.'] });
  if ((input.linkUrl && !input.linkLabel) || (!input.linkUrl && input.linkLabel))
    throw validationError({ linkLabel: ['Give both a link and its label, or neither.'] });
  const aid = id ?? newId('ann', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const v = [
    input.message,
    input.linkUrl,
    input.linkLabel,
    input.level,
    input.startsAt,
    input.endsAt,
    input.active ? 1 : 0,
  ];
  const res = await new Batch(ctx.db)
    .add(
      id
        ? stmt(
            ctx.db,
            'UPDATE announcements SET message = ?, link_url = ?, link_label = ?, level = ?, starts_at = ?, ends_at = ?, active = ?, updated_at = ? WHERE id = ?',
            ...v,
            now,
            id,
          )
        : stmt(
            ctx.db,
            'INSERT INTO announcements (id, message, link_url, link_label, level, starts_at, ends_at, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            aid,
            ...v,
            now,
            now,
          ),
      'save',
    )
    .add(bump(ctx))
    .add(
      audit(ctx, id ? 'announcement.updated' : 'announcement.created', 'announcement', aid, { active: input.active }),
    )
    .run();
  if (res.changes('save') !== 1) throw notFound();
  done();
  return { id: aid };
}

export async function deleteAnnouncement(ctx: RequestContext, id: string) {
  assertCan(ctx, 'cms.manage');
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM announcements WHERE id = ?', id), 'delete')
    .add(bump(ctx))
    .add(audit(ctx, 'announcement.deleted', 'announcement', id))
    .run();
  if (res.changes('delete') !== 1) throw notFound();
  done();
}
