import type { RequestContext } from '../context';
import { stmt } from '../db/client';
import { newId } from './ids';
import { redact } from './logger';

export type ActorType = 'staff' | 'client' | 'system' | 'provider' | 'public';

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  /** Overrides the actor taken from the context (e.g. 'provider' for gateway callbacks). */
  actorType?: ActorType;
  actorUserId?: string | null;
}

/** Builds an audit_logs INSERT to include in the same batch as the change it records. Before/after are redacted. */
export function auditStmt(ctx: RequestContext, entry: AuditEntry): D1PreparedStatement {
  const actorType = entry.actorType ?? ctx.actor.type;
  const actorUserId = entry.actorUserId !== undefined ? entry.actorUserId : ctx.actor.userId;
  const json = (v: unknown) => (v === undefined ? null : JSON.stringify(redact(v)));
  return stmt(
    ctx.db,
    `INSERT INTO audit_logs (id, actor_user_id, actor_type, action, entity_type, entity_id, before, after, ip, user_agent, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId('aud', ctx.now().getTime()),
    actorUserId,
    actorType,
    entry.action,
    entry.entityType ?? null,
    entry.entityId ?? null,
    json(entry.before),
    json(entry.after),
    ctx.ip,
    ctx.userAgent,
    ctx.requestId,
    ctx.now().toISOString(),
  );
}
