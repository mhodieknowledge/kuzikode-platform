import type { RequestContext } from '../context';
import { rateLimited } from './errors';

export interface RateLimitRule {
  /** Unique key, e.g. `login:email:a@b.co`. */
  key: string;
  limit: number;
  windowSeconds: number;
}

function windowStart(now: Date, windowSeconds: number): string {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms).toISOString();
}

/**
 * Counts a hit in a D1 fixed window (docs/07 §4) with a single atomic upsert, and returns the new count.
 * Rows are pruned by the nightly cron after 7 days.
 */
export async function hit(ctx: RequestContext, rule: RateLimitRule): Promise<number> {
  const start = windowStart(ctx.now(), rule.windowSeconds);
  const row = await ctx.db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
    )
    .bind(rule.key, start)
    .first<{ count: number }>();
  return row?.count ?? 1;
}

/** Counts the hit and throws RATE_LIMITED (with Retry-After) once the limit is exceeded. */
export async function enforce(ctx: RequestContext, rule: RateLimitRule): Promise<void> {
  const count = await hit(ctx, rule);
  if (count > rule.limit) {
    const elapsed = (ctx.now().getTime() - Date.parse(windowStart(ctx.now(), rule.windowSeconds))) / 1000;
    throw rateLimited(Math.max(1, rule.windowSeconds - elapsed));
  }
}

/** Current count without incrementing (0 when the window has rolled over). */
export async function peek(ctx: RequestContext, rule: Pick<RateLimitRule, 'key' | 'windowSeconds'>): Promise<number> {
  const row = await ctx.db
    .prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
    .bind(rule.key)
    .first<{ window_start: string; count: number }>();
  if (!row || row.window_start !== windowStart(ctx.now(), rule.windowSeconds)) return 0;
  return row.count;
}

export async function reset(ctx: RequestContext, key: string): Promise<void> {
  await ctx.db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
}
