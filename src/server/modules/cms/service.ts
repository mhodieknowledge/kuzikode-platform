/**
 * Published website content (PRD §3, docs/03 §6). Every read goes through a cache keyed by `content_version`:
 * publishing anything bumps the version, so stale entries are simply never read again (no purge needed).
 */
import { SECTION_SCHEMAS, type Section, type SectionType } from '../../../shared/schemas/cms';
import type { RequestContext } from '../../context';
import { stmt } from '../../db/client';
import { sanitizeHtml } from '../../lib/html-sanitize';
import * as repo from './repository';

const VERSION_TTL_MS = 5_000;
const KV_TTL_SECONDS = 7 * 24 * 3600;
let versionCache: { value: number; at: number } | null = null;
const memo = new Map<string, unknown>();

/** Clears the per-isolate caches (tests, and right after a publish in the same isolate). */
export function resetCmsCache(): void {
  versionCache = null;
  memo.clear();
}

export async function contentVersion(ctx: RequestContext): Promise<number> {
  const now = Date.now();
  if (versionCache && now - versionCache.at < VERSION_TTL_MS) return versionCache.value;
  const row = await ctx.db
    .prepare("SELECT value FROM application_settings WHERE key = 'content_version'")
    .first<{ value: string }>();
  const value = row ? Number(JSON.parse(row.value)) || 1 : 1;
  if (versionCache && versionCache.value !== value) memo.clear();
  versionCache = { value, at: now };
  return value;
}

/** Statement that bumps content_version; put it in every publish batch. */
export function bumpContentVersionStmt(db: D1Database): D1PreparedStatement {
  return stmt(
    db,
    "UPDATE application_settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = 'content_version'",
  );
}

/** Loads through: isolate memory → KV (`cms:v<version>:<name>`) → D1. */
export async function cached<T>(ctx: RequestContext, name: string, loader: () => Promise<T>): Promise<T> {
  const version = await contentVersion(ctx);
  const key = `cms:v${version}:${name}`;
  if (memo.has(key)) return memo.get(key) as T;
  try {
    const hit = await ctx.env.CACHE.get(key, 'json');
    if (hit !== null) {
      memo.set(key, hit);
      return hit as T;
    }
  } catch (err) {
    ctx.logger.warn('cms cache read failed', { err, key });
  }
  const value = await loader();
  memo.set(key, value);
  ctx.waitUntil(
    ctx.env.CACHE.put(key, JSON.stringify(value), { expirationTtl: KV_TTL_SECONDS }).catch(() => undefined),
  );
  return value;
}

// ---------------------------------------------------------------- settings

export type Settings = Record<string, unknown>;

export function getSettings(ctx: RequestContext): Promise<Settings> {
  return cached(ctx, 'settings', async () => {
    const rows = await repo.allSettings(ctx.db);
    const out: Settings = {};
    for (const r of rows) {
      try {
        out[r.key] = JSON.parse(r.value);
      } catch {
        out[r.key] = r.value;
      }
    }
    return out;
  });
}

/** A string setting, or undefined when blank (blank settings are hidden, never shown as placeholders). */
export function settingText(settings: Settings, key: string): string | undefined {
  const v = settings[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

export function settingBool(settings: Settings, key: string, fallback = false): boolean {
  const v = settings[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function settingNumber(settings: Settings, key: string, fallback: number): number {
  const v = settings[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

// ---------------------------------------------------------------- pages & sections

export interface PublishedPage {
  key: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  sections: Section[];
}

function parseSections(ctx: RequestContext, rows: repo.SectionRow[]): Section[] {
  const out: Section[] = [];
  for (const row of rows) {
    const schema = SECTION_SCHEMAS[row.type as SectionType];
    if (!schema) continue;
    let parsed;
    try {
      parsed = schema.safeParse(JSON.parse(row.published_content));
    } catch {
      parsed = { success: false as const };
    }
    if (!parsed.success) {
      ctx.logger.warn('skipping invalid section', { section: row.key, type: row.type });
      continue;
    }
    const content = parsed.data as Record<string, unknown>;
    if (row.type === 'rich_text') content['html'] = sanitizeHtml(String(content['html'] ?? ''));
    out.push({ key: row.key, type: row.type as SectionType, content } as Section);
  }
  return out;
}

export function getPage(ctx: RequestContext, key: string): Promise<PublishedPage | null> {
  return cached(ctx, `page:${key}`, async () => {
    const page = await repo.pageByKey(ctx.db, key);
    if (!page) return null;
    return {
      key: page.key,
      title: page.title,
      seoTitle: page.seo_title,
      seoDescription: page.seo_description,
      sections: parseSections(ctx, await repo.publishedSections(ctx.db, key)),
    };
  });
}

export function sectionOf<T extends SectionType>(
  page: PublishedPage | null,
  key: string,
  type: T,
): Section<T> | undefined {
  const s = page?.sections.find((x) => x.key === key && x.type === type);
  return s as Section<T> | undefined;
}

// ---------------------------------------------------------------- services

export interface PublicService {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  pricingModel: repo.ServiceRow['pricing_model'];
  priceMinor: number | null;
  currency: string | null;
  status: 'active' | 'coming_soon';
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  benefits: { title: string; body: string }[];
  deliverables: string[];
  faq: { q: string; a: string }[];
  icon: string | null;
  status: 'active' | 'coming_soon';
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  services: PublicService[];
}

const parseJson = <T>(v: string, fallback: T): T => {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

/** Divisions and services: inactive ones are excluded; coming_soon ones are returned with that status (PRD §3.3). */
export function getServiceCatalogue(ctx: RequestContext): Promise<PublicCategory[]> {
  return cached(ctx, 'services', async () => {
    const [cats, svcs] = await Promise.all([repo.visibleCategories(ctx.db), repo.visibleServices(ctx.db)]);
    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      summary: c.summary,
      description: sanitizeHtml(c.description),
      benefits: parseJson(c.benefits, []),
      deliverables: parseJson(c.deliverables, []),
      faq: parseJson(c.faq, []),
      icon: c.icon,
      status: c.status as 'active' | 'coming_soon',
      featured: c.featured === 1,
      seoTitle: c.seo_title,
      seoDescription: c.seo_description,
      services: svcs
        .filter((s) => s.category_id === c.id)
        .map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          summary: s.summary,
          description: sanitizeHtml(s.description),
          pricingModel: s.pricing_model,
          priceMinor: s.price_minor,
          currency: s.currency,
          status: s.status as 'active' | 'coming_soon',
        })),
    }));
  });
}

export async function getCategory(ctx: RequestContext, slug: string): Promise<PublicCategory | null> {
  return (await getServiceCatalogue(ctx)).find((c) => c.slug === slug) ?? null;
}

// ---------------------------------------------------------------- portfolio, products, announcements

export interface PublicPortfolioItem {
  slug: string;
  name: string;
  clientName: string | null;
  category: string;
  summary: string;
  description: string;
  challenge: string;
  solution: string;
  technologies: string[];
  completionDate: string | null;
  externalUrl: string | null;
  coverMediaId: string | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function listPortfolio(ctx: RequestContext): Promise<PublicPortfolioItem[]> {
  return cached(ctx, 'portfolio', async () =>
    (await repo.publishedPortfolio(ctx.db)).map((p) => ({
      slug: p.slug,
      name: p.name,
      clientName: p.show_client_name === 1 ? p.client_name : null,
      category: p.category,
      summary: p.summary,
      description: sanitizeHtml(p.description),
      challenge: sanitizeHtml(p.challenge),
      solution: sanitizeHtml(p.solution),
      technologies: parseJson<string[]>(p.technologies, []),
      completionDate: p.completion_date,
      externalUrl: p.external_url && /^https?:\/\//.test(p.external_url) ? p.external_url : null,
      coverMediaId: p.cover_media_id,
      featured: p.featured === 1,
      seoTitle: p.seo_title,
      seoDescription: p.seo_description,
    })),
  );
}

export async function getPortfolioItem(ctx: RequestContext, slug: string): Promise<PublicPortfolioItem | null> {
  return (await listPortfolio(ctx)).find((p) => p.slug === slug) ?? null;
}

export function listProducts(ctx: RequestContext) {
  return cached(ctx, 'products', async () =>
    (await repo.publishedProducts(ctx.db)).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      status: p.status,
      interestFormEnabled: p.interest_form_enabled === 1,
    })),
  );
}

export async function currentAnnouncement(ctx: RequestContext) {
  const rows = await cached(ctx, 'announcements', () => repo.activeAnnouncements(ctx.db));
  const now = ctx.now().toISOString();
  const a = rows.find((r) => (!r.starts_at || r.starts_at <= now) && (!r.ends_at || r.ends_at > now));
  return a ? { id: a.id, message: a.message, linkUrl: a.link_url, linkLabel: a.link_label, level: a.level } : null;
}
