import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z
    .string()
    .regex(/^-?[a-z_]{1,40}$/)
    .optional(),
  q: z.string().trim().max(120).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Turns `sort=-created_at` into a safe ORDER BY using an allow-list of sortable fields → SQL columns.
 * Unknown fields fall back to the default. A stable tiebreaker (`id`) is always appended.
 */
export function orderBy(sort: string | undefined, allowed: Record<string, string>, fallback: string): string {
  const desc = sort?.startsWith('-') ?? false;
  const field = sort?.replace(/^-/, '');
  const column = field ? allowed[field] : undefined;
  if (!column) return `ORDER BY ${fallback}`;
  const tiebreak =
    column.endsWith('.id') || column === 'id'
      ? ''
      : `, ${column.includes('.') ? column.split('.')[0] + '.' : ''}id ${desc ? 'DESC' : 'ASC'}`;
  return `ORDER BY ${column} ${desc ? 'DESC' : 'ASC'}${tiebreak}`;
}

export function limitOffset(q: Pick<ListQuery, 'page' | 'pageSize'>): { limit: number; offset: number } {
  return { limit: q.pageSize, offset: (q.page - 1) * q.pageSize };
}

/** Escapes LIKE wildcards in user search text; use with `LIKE ? ESCAPE '\'`. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
