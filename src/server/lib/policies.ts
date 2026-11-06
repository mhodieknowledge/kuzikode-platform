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

/**
 * Portal areas and the client access roles that may see them (owner sees everything). Money (invoices, credit notes,
 * payments, receipts) is for owners and billing contacts; delivery (projects, messages, deliverables) for owners and
 * members; quotations and support for everyone linked to the client.
 */
export const PORTAL_AREAS = ['finance', 'projects', 'quotations', 'support'] as const;
export type PortalArea = (typeof PORTAL_AREAS)[number];
const AREA_ROLES: Record<PortalArea, readonly string[]> = {
  finance: ['owner', 'billing'],
  projects: ['owner', 'member'],
  quotations: ['owner', 'member', 'billing'],
  support: ['owner', 'member', 'billing'],
};

/** The client IDs whose `area` the portal caller may see. Empty means "nothing" (never "everything"). */
export function portalAreaClientIds(ctx: RequestContext, area: PortalArea): string[] {
  const ids = portalClientIds(ctx);
  const roles = ctx.auth!.clientRoles;
  return ids.filter((id) => AREA_ROLES[area].includes(roles[id] ?? ''));
}
