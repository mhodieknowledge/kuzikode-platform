-- Migration 0004: catalogue. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0004 service catalogue & packages ------------------------------------------------------
CREATE TABLE service_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  benefits TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(benefits)),
  deliverables TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(deliverables)),
  faq TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(faq)),
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','coming_soon','inactive')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT, seo_description TEXT,
  og_image_id TEXT REFERENCES media_assets(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_service_categories_status_sort ON service_categories(status, sort_order);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES service_categories(id),
  slug TEXT NOT NULL CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  pricing_model TEXT NOT NULL DEFAULT 'custom_quote' CHECK (pricing_model IN ('fixed','hourly','starting_from','custom_quote')),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT REFERENCES currencies(code),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','coming_soon','inactive')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (category_id, slug),
  CHECK (pricing_model = 'custom_quote' OR (price_minor IS NOT NULL AND currency IS NOT NULL))
);
CREATE INDEX idx_services_category_sort ON services(category_id, status, sort_order);

CREATE TABLE service_packages (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('one_off','recurring')),
  interval TEXT CHECK (interval IS NULL OR interval IN ('month','year')),
  price_type TEXT NOT NULL CHECK (price_type IN ('fixed','starting_from','custom_quote')),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT REFERENCES currencies(code),
  price_unit TEXT,
  alt_price_zwg_minor INTEGER CHECK (alt_price_zwg_minor IS NULL OR alt_price_zwg_minor >= 0),
  annual_price_minor INTEGER CHECK (annual_price_minor IS NULL OR annual_price_minor >= 0),
  min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  delivery_time TEXT, revision_rounds TEXT, support_period TEXT,
  most_popular INTEGER NOT NULL DEFAULT 0 CHECK (most_popular IN (0,1)),
  pricing_tab TEXT NOT NULL DEFAULT 'other' CHECK (pricing_tab IN ('websites','care','email','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','coming_soon','inactive')),
  price_review_required INTEGER NOT NULL DEFAULT 1 CHECK (price_review_required IN (0,1)),
  cost_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (service_id, slug),
  CHECK (price_type = 'custom_quote' OR (price_minor IS NOT NULL AND currency IS NOT NULL)),
  CHECK ((billing_type = 'recurring') = (interval IS NOT NULL))
);
CREATE INDEX idx_packages_service ON service_packages(service_id, status, sort_order);
CREATE INDEX idx_packages_tab ON service_packages(pricing_tab, status, sort_order);

CREATE TABLE package_features (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES service_packages(id),
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('included','not_included','text')),
  value_text TEXT,
  tooltip TEXT,
  comparison_key TEXT,
  CHECK (value_type <> 'text' OR value_text IS NOT NULL)
);
CREATE INDEX idx_package_features_pkg ON package_features(package_id, position);

CREATE TABLE package_addons (
  id TEXT PRIMARY KEY,
  package_id TEXT REFERENCES service_packages(id),
  name TEXT NOT NULL,
  description TEXT,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL REFERENCES currencies(code),
  unit TEXT NOT NULL CHECK (unit IN ('each','page','mailbox','month','year','hour')),
  billing_type TEXT NOT NULL DEFAULT 'one_off' CHECK (billing_type IN ('one_off','recurring')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_package_addons_pkg ON package_addons(package_id, active, sort_order);
