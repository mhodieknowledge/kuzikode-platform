/**
 * ⌘K global search (P4.1): clients, invoices, quotations and projects by number/reference or name, each source only
 * when the user holds its view permission. Bound LIKE parameters with escaped wildcards; small result caps.
 */
import type { RequestContext } from '../../context';
import type { AuthState } from '../auth/service';

export interface AdminSearchResult {
  kind: 'client' | 'invoice' | 'quotation' | 'project';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const PER_KIND = 6;

/** LIKE pattern with %, _ and \ escaped (used with ESCAPE '\'). */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function adminSearch(ctx: RequestContext, auth: AuthState, raw: string): Promise<AdminSearchResult[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = likePattern(q);
  const can = (p: Parameters<AuthState['permissions']['has']>[0]) => auth.permissions.has(p);
  const tasks: Promise<AdminSearchResult[]>[] = [];

  if (can('clients.view')) {
    tasks.push(
      ctx.db
        .prepare(
          `SELECT id, client_number, display_name, email FROM clients
           WHERE display_name LIKE ?1 ESCAPE '\\' OR client_number LIKE ?1 ESCAPE '\\' OR email LIKE ?1 ESCAPE '\\'
           ORDER BY status = 'archived', display_name LIMIT ${PER_KIND}`,
        )
        .bind(like)
        .all<{ id: string; client_number: string; display_name: string; email: string | null }>()
        .then(({ results }) =>
          results.map((r) => ({
            kind: 'client' as const,
            id: r.id,
            title: r.display_name,
            subtitle: [r.client_number, r.email].filter(Boolean).join(' · '),
            href: `/admin/clients/${r.id}`,
          })),
        ),
    );
  }
  if (can('invoices.view')) {
    tasks.push(
      ctx.db
        .prepare(
          `SELECT i.id, i.number, i.status, c.display_name FROM invoices i JOIN clients c ON c.id = i.client_id
           WHERE i.number LIKE ?1 ESCAPE '\\' OR c.display_name LIKE ?1 ESCAPE '\\'
           ORDER BY i.created_at DESC LIMIT ${PER_KIND}`,
        )
        .bind(like)
        .all<{ id: string; number: string | null; status: string; display_name: string }>()
        .then(({ results }) =>
          results.map((r) => ({
            kind: 'invoice' as const,
            id: r.id,
            title: r.number ?? 'Draft invoice',
            subtitle: `${r.display_name} · ${r.status}`,
            href: `/admin/invoices/${r.id}`,
          })),
        ),
    );
  }
  if (can('quotations.view')) {
    tasks.push(
      ctx.db
        .prepare(
          `SELECT q.id, q.number, q.title, q.status, c.display_name FROM quotations q JOIN clients c ON c.id = q.client_id
           WHERE q.number LIKE ?1 ESCAPE '\\' OR q.title LIKE ?1 ESCAPE '\\' OR c.display_name LIKE ?1 ESCAPE '\\'
           ORDER BY q.created_at DESC LIMIT ${PER_KIND}`,
        )
        .bind(like)
        .all<{ id: string; number: string | null; title: string; status: string; display_name: string }>()
        .then(({ results }) =>
          results.map((r) => ({
            kind: 'quotation' as const,
            id: r.id,
            title: `${r.number ?? 'Draft'} · ${r.title}`,
            subtitle: `${r.display_name} · ${r.status}`,
            href: `/admin/quotations/${r.id}`,
          })),
        ),
    );
  }
  if (can('projects.view_all') || can('projects.view')) {
    const all = can('projects.view_all');
    tasks.push(
      ctx.db
        .prepare(
          `SELECT p.id, p.reference, p.name, p.status, c.display_name FROM projects p JOIN clients c ON c.id = p.client_id
           WHERE (p.reference LIKE ?1 ESCAPE '\\' OR p.name LIKE ?1 ESCAPE '\\' OR c.display_name LIKE ?1 ESCAPE '\\')
             AND (?2 = 1 OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ?3))
           ORDER BY p.created_at DESC LIMIT ${PER_KIND}`,
        )
        .bind(like, all ? 1 : 0, auth.user.id)
        .all<{ id: string; reference: string; name: string; status: string; display_name: string }>()
        .then(({ results }) =>
          results.map((r) => ({
            kind: 'project' as const,
            id: r.id,
            title: `${r.reference} · ${r.name}`,
            subtitle: `${r.display_name} · ${r.status}`,
            href: `/admin/projects/${r.id}`,
          })),
        ),
    );
  }
  return (await Promise.all(tasks)).flat();
}
