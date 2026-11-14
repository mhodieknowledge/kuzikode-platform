-- Migration 0016: the home SEO title must stay within 70 characters after the R9.3 brand rename.
UPDATE website_pages SET seo_title = 'Kuzikode Intelligent Technologies · Intelligent digital solutions' WHERE seo_title = 'Kuzikode Intelligent Technologies · Building intelligent digital solutions';
UPDATE application_settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = 'content_version';
