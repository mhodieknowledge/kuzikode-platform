import { all, first } from '../../db/client';

export interface PageRow {
  id: string;
  key: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_id: string | null;
  status: string;
}
export interface SectionRow {
  key: string;
  type: string;
  position: number;
  published_content: string;
}
export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  benefits: string;
  deliverables: string;
  faq: string;
  icon: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  featured: number;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
}
export interface ServiceRow {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  pricing_model: 'fixed' | 'hourly' | 'starting_from' | 'custom_quote';
  price_minor: number | null;
  currency: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  sort_order: number;
}
export interface PortfolioRow {
  id: string;
  slug: string;
  name: string;
  client_name: string | null;
  show_client_name: number;
  category: string;
  summary: string;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  technologies: string;
  completion_date: string | null;
  external_url: string | null;
  cover_media_id: string | null;
  featured: number;
  seo_title: string | null;
  seo_description: string | null;
}
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  status: 'in_development' | 'beta' | 'available';
  interest_form_enabled: number;
}
export interface AnnouncementRow {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  level: 'info' | 'important';
}

export const pageByKey = (db: D1Database, key: string) =>
  first<PageRow>(
    db,
    "SELECT id, key, title, seo_title, seo_description, og_image_id, status FROM website_pages WHERE key = ? AND status = 'published'",
    key,
  );

export const publishedSections = (db: D1Database, pageKey: string) =>
  all<SectionRow>(
    db,
    `SELECT s.key, s.type, s.position, s.published_content FROM website_sections s JOIN website_pages p ON p.id = s.page_id
     WHERE p.key = ? AND p.status = 'published' AND s.visible = 1 AND s.published_content IS NOT NULL ORDER BY s.position, s.key`,
    pageKey,
  );

export const visibleCategories = (db: D1Database) =>
  all<CategoryRow>(db, "SELECT * FROM service_categories WHERE status <> 'inactive' ORDER BY sort_order, name");

export const visibleServices = (db: D1Database) =>
  all<ServiceRow>(
    db,
    `SELECT s.id, s.category_id, s.slug, s.name, s.summary, s.description, s.pricing_model, s.price_minor, s.currency, s.status, s.sort_order
     FROM services s JOIN service_categories c ON c.id = s.category_id
     WHERE s.status <> 'inactive' AND c.status <> 'inactive' ORDER BY s.sort_order, s.name`,
  );

export const publishedPortfolio = (db: D1Database) =>
  all<PortfolioRow>(
    db,
    `SELECT id, slug, name, client_name, show_client_name, category, summary, description, challenge, solution, technologies,
       completion_date, external_url, cover_media_id, featured, seo_title, seo_description
     FROM portfolio_projects WHERE status = 'published' ORDER BY featured DESC, sort_order, completion_date DESC LIMIT 200`,
  );

export const publishedProducts = (db: D1Database) =>
  all<ProductRow>(
    db,
    'SELECT id, slug, name, tagline, description, status, interest_form_enabled FROM products WHERE published = 1 ORDER BY sort_order, name',
  );

export interface AnnouncementWindowRow extends AnnouncementRow {
  starts_at: string | null;
  ends_at: string | null;
}

/** Active announcements with their time windows (filtered by the current time in the service, so caching is safe). */
export const activeAnnouncements = (db: D1Database) =>
  all<AnnouncementWindowRow>(
    db,
    `SELECT id, message, link_url, link_label, level, starts_at, ends_at FROM announcements
     WHERE active = 1 ORDER BY CASE level WHEN 'important' THEN 0 ELSE 1 END, created_at DESC LIMIT 20`,
  );

export const allSettings = (db: D1Database) =>
  all<{ key: string; value: string }>(db, 'SELECT key, value FROM application_settings');
