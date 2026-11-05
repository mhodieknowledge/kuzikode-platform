/** Cross-module authorisation helpers (docs/07 §5). Module-specific rules live in each module's policies.ts. */
import type { Permission } from '../../shared/permissions';
import type { RequestContext } from '../context';
import { forbidden, notFound, unauthenticated } from './errors';

export function can(ctx: RequestContext, permission: Permission): boolean {
  return ctx.auth?.session.audience === 'admin' && ctx.auth.permissions.has(permission);
}

export function assertCan(ctx: RequestContext, ...permissions: Permission[]): void {
  if (!ctx.auth) throw unauthenticated();
  if (ctx.auth.session.audience !== 'admin' || !permissions.every((p) => ctx.auth!.permissions.has(p))) {
    throw forbidden(undefined, `missing ${permissions.join(',')}`);
  }
}

export function isSuperAdmin(ctx: RequestContext): boolean {
  return ctx.auth?.roles.includes('super_admin') ?? false;
}

/** The client IDs a portal user may see. Throws for non-portal callers so staff code never uses it by mistake. */
export function portalClientIds(ctx: RequestContext): string[] {
  if (!ctx.auth || ctx.auth.session.audience !== 'portal') throw unauthenticated();
  return ctx.auth.clientIds;
}

/** Portal resources outside the caller's clients are reported as NOT_FOUND (no enumeration). */
export function assertPortalClient(ctx: RequestContext, clientId: string | null | undefined): void {
  if (!clientId || !portalClientIds(ctx).includes(clientId)) throw notFound();
}

/**
 * `<column> IN (?, ?, …)` for SQL-level client scoping (defence in depth with assertPortalClient).
 * An empty scope yields a predicate that matches nothing.
 */
export function clientScope(column: string, clientIds: readonly string[]): { sql: string; params: string[] } {
  if (!/^[a-z_]+(\.[a-z_]+)?$/.test(column)) throw new Error('Invalid scope column');
  if (clientIds.length === 0) return { sql: '1 = 0', params: [] };
  return { sql: `${column} IN (${clientIds.map(() => '?').join(', ')})`, params: [...clientIds] };
}
