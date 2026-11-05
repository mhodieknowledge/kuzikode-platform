-- Migration 0008: content. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0008 website content (CMS) -------------------------------------------------------------
CREATE TABLE website_pages (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  seo_title TEXT, seo_description TEXT,
  og_image_id TEXT REFERENCES media_assets(id),
  body_draft TEXT, body_published TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE website_sections (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES website_pages(id),
  key TEXT NOT NULL,
  type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  draft_content TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(draft_content)),
  published_content TEXT CHECK (published_content IS NULL OR json_valid(published_content)),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (page_id, key)
);
CREATE INDEX idx_sections_page ON website_sections(page_id, position);

CREATE TABLE portfolio_projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_name TEXT,
  show_client_name INTEGER NOT NULL DEFAULT 0 CHECK (show_client_name IN (0,1)),
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT, challenge TEXT, solution TEXT,
  technologies TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(technologies)),
  completion_date TEXT,
  external_url TEXT,
  cover_media_id TEXT REFERENCES media_assets(id),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT, seo_description TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_portfolio_status ON portfolio_projects(status, featured, sort_order);

CREATE TABLE portfolio_media (
  portfolio_id TEXT NOT NULL REFERENCES portfolio_projects(id),
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (portfolio_id, media_id)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_development' CHECK (status IN ('in_development','beta','available')),
  interest_form_enabled INTEGER NOT NULL DEFAULT 0 CHECK (interest_form_enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  link_url TEXT, link_label TEXT,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','important')),
  starts_at TEXT, ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  photo_media_id TEXT REFERENCES media_assets(id),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE post_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  cover_media_id TEXT REFERENCES media_assets(id),
  category_id TEXT REFERENCES post_categories(id),
  author_user_id TEXT REFERENCES users(id),
  author_display_name TEXT NOT NULL,
  reading_minutes INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  publish_at TEXT, published_at TEXT,
  seo_title TEXT, seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_posts_status ON posts(status, published_at);
CREATE INDEX idx_posts_category ON posts(category_id, status);

CREATE TABLE post_tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE post_tag_links (
  post_id TEXT NOT NULL REFERENCES posts(id),
  tag_id TEXT NOT NULL REFERENCES post_tags(id),
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX idx_post_tag_links_tag ON post_tag_links(tag_id);

CREATE TABLE industries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  challenges TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(challenges)),
  body TEXT,
  icon TEXT,
  cover_media_id TEXT REFERENCES media_assets(id),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT, seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE industry_services (
  industry_id TEXT NOT NULL REFERENCES industries(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  PRIMARY KEY (industry_id, service_id)
);

CREATE TABLE faqs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('general','pricing','projects','support','careers')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  service_id TEXT REFERENCES services(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_faqs_category ON faqs(category, published, sort_order);

CREATE TABLE testimonials (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  project_id TEXT REFERENCES projects(id),
  author_name TEXT NOT NULL,
  author_role TEXT,
  quote TEXT NOT NULL,
  consent_obtained INTEGER NOT NULL CHECK (consent_obtained = 1),
  consent_date TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE technologies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  logo_svg_path TEXT,
  category TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','unsubscribed')),
  confirm_token_hash TEXT UNIQUE,
  confirmed_at TEXT, unsubscribed_at TEXT,
  source TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_newsletter_status ON newsletter_subscribers(status, created_at);
