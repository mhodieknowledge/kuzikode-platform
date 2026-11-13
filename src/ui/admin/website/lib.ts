/**
 * Pure helpers shared by the Website admin modules (R6.2 group 4): slugs, list and CSV text fields, date inputs, reordering
 * and form-error lookups. Carried over unchanged from the pre-redesign islands (ServicesAdmin, CmsAdmin, ContentAdmin,
 * CareersAdmin); unit-tested in tests/unit/admin-website.test.ts.
 */
import { apiFetch } from '../../lib/api';
import type { FieldErrors } from '../action';

/** Web address from a name: lower case, ASCII, hyphens, at most 80 characters. */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** The address the form will send: the typed one once touched, else the typed-or-derived one. */
export const effectiveSlug = (slug: string, touched: boolean, name: string): string =>
  touched ? slug : slug || slugify(name);

/** One entry per non-empty line, trimmed. */
export const lines = (v: string): string[] =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** One entry per comma-separated item, trimmed, empties dropped. */
export const splitCsv = (v: string): string[] =>
  v
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/** A UTC ISO timestamp for `<input type="datetime-local">` (shown and edited as UTC). */
export const toUtcInput = (iso: string | null): string => (iso ? iso.slice(0, 16) : '');

/** ISO → `datetime-local` value in Harare time (UTC+2). */
export const toHarareInput = (iso: string | null): string =>
  iso ? new Date(new Date(iso).getTime() + 2 * 3600_000).toISOString().slice(0, 16) : '';
/** `datetime-local` value in Harare time → ISO. */
export const fromHarareInput = (v: string): string | null => (v ? new Date(`${v}:00+02:00`).toISOString() : null);

/** Moves one item; returns null when the move is out of range or a no-op. */
export function moveItem<T>(list: T[], from: number, to: number): T[] | null {
  if (to < 0 || to >= list.length || from === to || from < 0 || from >= list.length) return null;
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m as T);
  return next;
}

/** Messages for a list field: the key itself and any `key.N.sub` entries, in order. */
export const listErrors = (errors: FieldErrors, key: string): string[] =>
  Object.entries(errors)
    .filter(([k]) => k === key || k.startsWith(`${key}.`))
    .flatMap(([, v]) => v);

/** First message of `listErrors`, for the Field `error` prop. */
export const firstListError = (errors: FieldErrors, key: string): string | undefined => listErrors(errors, key)[0];

/** Replace one item of a list by index. */
export const patchAt = <T>(list: T[], i: number, patch: Partial<T>): T[] =>
  list.map((x, j) => (j === i ? { ...x, ...patch } : x));

/** Add or remove an id from a selection list. */
export const toggleId = (ids: string[], id: string, on: boolean): string[] =>
  on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id);

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active (shown)' },
  { value: 'coming_soon', label: 'Coming soon (shown, no quote button)' },
  { value: 'inactive', label: 'Hidden' },
] as const;

export const STATUS_PILL: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  active: { label: 'Active', tone: 'ok' },
  coming_soon: { label: 'Coming soon', tone: 'warn' },
  inactive: { label: 'Hidden', tone: 'neutral' },
};

/** API client for one admin base path; every call returns the `{ data: { id? } }` envelope. */
export const adminApi =
  (base: string) =>
  (path: string, init: { method?: string; body?: unknown } = {}) =>
    apiFetch<{ data: { id?: string } }>(`${base}${path}`, init);

export const cmsApi = adminApi('/api/v1/admin/cms');
export const contentApi = adminApi('/api/v1/admin/content');
