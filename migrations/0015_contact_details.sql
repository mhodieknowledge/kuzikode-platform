-- Migration 0015: the company's real contact details (R9.5, docs/redesign/REFINEMENTS.md §6). Only blank settings are filled,
-- so anything the owner already edited in Admin -> Settings is kept. content_version is bumped so every cache misses.

UPDATE application_settings SET value = '"info@kuzikode.com"', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = 'contact.email' AND value IN ('""', '');
UPDATE application_settings SET value = '"+263 88 294 6290"', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = 'contact.phone' AND value IN ('""', '');
UPDATE application_settings SET value = '"+263 77 882 5898"', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = 'contact.whatsapp_number' AND value IN ('""', '');
UPDATE application_settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = 'content_version';
