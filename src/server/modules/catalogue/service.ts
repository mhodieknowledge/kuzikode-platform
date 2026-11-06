/**
 * Admin → Services (P4.6, PRD §4.2 C): divisions (service_categories) and their services. Every write bumps the
 * content version in the same batch (so the public site and edge cache pick it up at once) and writes an audit row.
 */
import type { RequestContext } from '../../context';
import { Batch, isUniqueViolation, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { conflict, notFound, validationError } from '../../lib/errors';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import type { CategoryInput, ServiceInput } from '../../../shared/schemas/catalogue';
import { bumpContentVersionStmt, resetCmsCache } from '../cms';

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  benefits: { title: string; body: string }[];
  deliverables: string[];
  faq: { q: string; a: string }[];
  icon: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  featured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface AdminService {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  pricingModel: 'fixed' | 'hourly' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  currency: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  featured: boolean;
  sortOrder: number;
  packages: number;
  updatedAt: string;
}

interface CategoryDb {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  benefits: string;
  deliverables: string;
  faq: string;
  icon: string | null;
  status: AdminCategory['status'];
  featured: number;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
}
interface ServiceDb {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  pricing_model: AdminService['pricingModel'];
  price_minor: number | null;
  currency: string | null;
  status: AdminService['status'];
  featured: number;
  sort_order: number;
  packages: number;
  updated_at: string;
}

const json = <T>(v: string, fallback: T): T => {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

const toCategory = (r: CategoryDb): AdminCategory => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  summary: r.summary,
  description: r.description ?? '',
  benefits: json(r.benefits, []),
  deliverables: json(r.deliverables, []),
  faq: json(r.faq, []),
  icon: r.icon,
  status: r.status,
  featured: r.featured === 1,
  sortOrder: r.sort_order,
  seoTitle: r.seo_title,
  seoDescription: r.seo_description,
  updatedAt: r.updated_at,
});

const toService = (r: ServiceDb): AdminService => ({
  id: r.id,
  categoryId: r.category_id,
  slug: r.slug,
  name: r.name,
  summary: r.summary,
  description: r.description ?? '',
  pricingModel: r.pricing_model,
  priceMinor: r.price_minor,
  currency: r.currency,
  status: r.status,
  featured: r.featured === 1,
  sortOrder: r.sort_order,
  packages: r.packages,
  updatedAt: r.updated_at,
});

const SERVICE_SELECT = `SELECT s.*, (SELECT COUNT(*) FROM service_packages p WHERE p.service_id = s.id) AS packages FROM services s`;

/** Every division with its services, including inactive ones, in display order. */
export async function listCatalogue(ctx: RequestContext) {
  assertCan(ctx, 'services.manage');
  const [cats, svcs] = await ctx.db.batch([
    ctx.db.prepare('SELECT * FROM service_categories ORDER BY sort_order, name'),
    ctx.db.prepare(`${SERVICE_SELECT} ORDER BY s.sort_order, s.name`),
  ]);
  const services = ((svcs?.results ?? []) as ServiceDb[]).map(toService);
  return ((cats?.results ?? []) as CategoryDb[]).map((c) => ({
    ...toCategory(c),
    services: services.filter((s) => s.categoryId === c.id),
  }));
}

export async function getCategoryAdmin(ctx: RequestContext, id: string): Promise<AdminCategory> {
  assertCan(ctx, 'services.manage');
  const row = await ctx.db.prepare('SELECT * FROM service_categories WHERE id = ?').bind(id).first<CategoryDb>();
  if (!row) throw notFound();
  return toCategory(row);
}

export async function getServiceAdmin(ctx: RequestContext, id: string): Promise<AdminService> {
  assertCan(ctx, 'services.manage');
  const row = await ctx.db.prepare(`${SERVICE_SELECT} WHERE s.id = ?`).bind(id).first<ServiceDb>();
  if (!row) throw notFound();
  return toService(row);
}

const categoryValues = (input: CategoryInput) => [
  input.slug,
  input.name,
  input.summary,
  sanitizeHtml(input.description) || null,
  JSON.stringify(input.benefits),
  JSON.stringify(input.deliverables),
  JSON.stringify(input.faq),
  input.icon,
  input.status,
  input.featured ? 1 : 0,
  input.seoTitle,
  input.seoDescription,
];

async function runWrite(batch: Batch, slugField = 'slug') {
  try {
    const res = await batch.run();
    resetCmsCache();
    return res;
  } catch (err) {
    if (isUniqueViolation(err)) throw validationError({ [slugField]: ['That web address is already in use.'] });
    throw err;
  }
}

export async function createCategory(ctx: RequestContext, input: CategoryInput): Promise<{ id: string }> {
  assertCan(ctx, 'services.manage');
  const id = newId('scat', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `INSERT INTO service_categories (id, slug, name, summary, description, benefits, deliverables, faq, icon, status, featured,
             seo_title, seo_description, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM service_categories), ?, ?)`,
          id,
          ...categoryValues(input),
          now,
          now,
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'service_category.created',
          entityType: 'service_category',
          entityId: id,
          after: { slug: input.slug, name: input.name, status: input.status },
        }),
      ),
  );
  return { id };
}

export async function updateCategory(ctx: RequestContext, id: string, input: CategoryInput): Promise<void> {
  const before = await getCategoryAdmin(ctx, id);
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `UPDATE service_categories SET slug = ?, name = ?, summary = ?, description = ?, benefits = ?, deliverables = ?, faq = ?, icon = ?,
             status = ?, featured = ?, seo_title = ?, seo_description = ?, updated_at = ? WHERE id = ?`,
          ...categoryValues(input),
          now,
          id,
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'service_category.updated',
          entityType: 'service_category',
          entityId: id,
          before: { slug: before.slug, name: before.name, status: before.status, featured: before.featured },
          after: { slug: input.slug, name: input.name, status: input.status, featured: input.featured },
        }),
      ),
  );
}

/** A division can be deleted only when it has no services (set it inactive to hide it instead). */
export async function deleteCategory(ctx: RequestContext, id: string): Promise<void> {
  const before = await getCategoryAdmin(ctx, id);
  const used = await ctx.db.prepare('SELECT 1 FROM services WHERE category_id = ? LIMIT 1').bind(id).first();
  if (used) throw conflict('This division still has services. Move or delete them first, or set it to hidden.');
  await runWrite(
    new Batch(ctx.db)
      .add(stmt(ctx.db, 'DELETE FROM service_categories WHERE id = ?', id))
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'service_category.deleted',
          entityType: 'service_category',
          entityId: id,
          before: { slug: before.slug, name: before.name },
        }),
      ),
  );
}

const serviceValues = (input: ServiceInput) => {
  const priced = input.pricingModel !== 'custom_quote';
  return [
    input.categoryId,
    input.slug,
    input.name,
    input.summary,
    sanitizeHtml(input.description) || null,
    input.pricingModel,
    priced ? (input.priceMinor ?? null) : null,
    priced ? (input.currency ?? null) : null,
    input.status,
    input.featured ? 1 : 0,
  ];
};

async function checkServiceRefs(ctx: RequestContext, input: ServiceInput) {
  const [cat, cur] = await ctx.db.batch([
    ctx.db.prepare('SELECT 1 AS ok FROM service_categories WHERE id = ?').bind(input.categoryId),
    ctx.db.prepare('SELECT 1 AS ok FROM currencies WHERE code = ? AND active = 1').bind(input.currency ?? ''),
  ]);
  if (!(cat?.results ?? []).length) throw validationError({ categoryId: ['Choose a division.'] });
  if (input.pricingModel !== 'custom_quote' && !(cur?.results ?? []).length)
    throw validationError({ currency: ['Choose an active currency.'] });
}

export async function createService(ctx: RequestContext, input: ServiceInput): Promise<{ id: string }> {
  assertCan(ctx, 'services.manage');
  await checkServiceRefs(ctx, input);
  const id = newId('svc', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `INSERT INTO services (id, category_id, slug, name, summary, description, pricing_model, price_minor, currency, status, featured,
             sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM services WHERE category_id = ?), ?, ?)`,
          id,
          ...serviceValues(input),
          input.categoryId,
          now,
          now,
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'service.created',
          entityType: 'service',
          entityId: id,
          after: { slug: input.slug, name: input.name, status: input.status, pricingModel: input.pricingModel },
        }),
      ),
  );
  return { id };
}

export async function updateService(ctx: RequestContext, id: string, input: ServiceInput): Promise<void> {
  const before = await getServiceAdmin(ctx, id);
  await checkServiceRefs(ctx, input);
  const now = ctx.now().toISOString();
  const moved = before.categoryId !== input.categoryId;
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `UPDATE services SET category_id = ?, slug = ?, name = ?, summary = ?, description = ?, pricing_model = ?, price_minor = ?, currency = ?,
             status = ?, featured = ?, updated_at = ?${moved ? ', sort_order = (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM services WHERE category_id = ?)' : ''}
           WHERE id = ?`,
          ...serviceValues(input),
          now,
          ...(moved ? [input.categoryId] : []),
          id,
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'service.updated',
          entityType: 'service',
          entityId: id,
          before: {
            categoryId: before.categoryId,
            slug: before.slug,
            status: before.status,
            pricingModel: before.pricingModel,
            priceMinor: before.priceMinor,
            currency: before.currency,
          },
          after: {
            categoryId: input.categoryId,
            slug: input.slug,
            status: input.status,
            pricingModel: input.pricingModel,
            priceMinor: input.pricingModel === 'custom_quote' ? null : (input.priceMinor ?? null),
            currency: input.pricingModel === 'custom_quote' ? null : (input.currency ?? null),
          },
        }),
      ),
  );
}

/** Tables that may refer to a service; a referenced service can only be hidden, never deleted. */
const SERVICE_REFS = [
  'service_packages',
  'enquiries',
  'lead_services',
  'quotation_items',
  'invoice_items',
  'industry_services',
  'faqs',
] as const;

/** True when anything refers to the service (it can then only be hidden). */
export async function serviceInUse(ctx: RequestContext, id: string): Promise<boolean> {
  // One SELECT of EXISTS terms (D1 caps the number of terms in a compound SELECT).
  const row = await ctx.db
    .prepare(
      `SELECT ${SERVICE_REFS.map((t) => `EXISTS (SELECT 1 FROM ${t} WHERE service_id = ?)`).join(' OR ')} AS used`,
    )
    .bind(...SERVICE_REFS.map(() => id))
    .first<{ used: number }>();
  return row?.used === 1;
}

export async function deleteService(ctx: RequestContext, id: string): Promise<void> {
  const before = await getServiceAdmin(ctx, id);
  if (await serviceInUse(ctx, id))
    throw conflict(
      'This service is used by packages, enquiries, leads, documents or content. Set it to hidden instead.',
    );
  await runWrite(
    new Batch(ctx.db)
      .add(stmt(ctx.db, 'DELETE FROM services WHERE id = ?', id))
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'service.deleted',
          entityType: 'service',
          entityId: id,
          before: { slug: before.slug, name: before.name, categoryId: before.categoryId },
        }),
      ),
  );
}

/** Saves a new display order. `ids` must be exactly the divisions (or one division's services), in the new order. */
export async function reorder(
  ctx: RequestContext,
  target: { kind: 'categories' } | { kind: 'services'; categoryId: string },
  ids: string[],
): Promise<void> {
  assertCan(ctx, 'services.manage');
  const table = target.kind === 'categories' ? 'service_categories' : 'services';
  const { results } = await (
    target.kind === 'categories'
      ? ctx.db.prepare('SELECT id FROM service_categories')
      : ctx.db.prepare('SELECT id FROM services WHERE category_id = ?').bind(target.categoryId)
  ).all<{ id: string }>();
  const existing = new Set(results.map((r) => r.id));
  if (ids.length !== existing.size || new Set(ids).size !== ids.length || ids.some((i) => !existing.has(i)))
    throw conflict('The list changed while you were sorting. Reload the page and try again.');
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .addAll(
        ids.map((id, i) => stmt(ctx.db, `UPDATE ${table} SET sort_order = ?, updated_at = ? WHERE id = ?`, i, now, id)),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: target.kind === 'categories' ? 'service_category.reordered' : 'service.reordered',
          entityType: 'service_category',
          entityId: target.kind === 'categories' ? 'all' : target.categoryId,
          after: { order: ids },
        }),
      ),
  );
}
