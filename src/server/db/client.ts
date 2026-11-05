import { conflict } from '../lib/errors';

/** D1's limit on bound parameters per statement. */
export const MAX_BOUND_PARAMS = 100;

export async function first<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return db
    .prepare(sql)
    .bind(...params)
    .first<T>();
}

export async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return results;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
  return db
    .prepare(sql)
    .bind(...params)
    .run();
}

export function stmt(db: D1Database, sql: string, ...params: unknown[]): D1PreparedStatement {
  return db.prepare(sql).bind(...params);
}

/**
 * Collects statements for one atomic `db.batch()` (D1 runs a batch as a single transaction).
 * Labels let callers read a specific statement's result afterwards.
 */
export class Batch {
  private readonly items: { label: string | undefined; stmt: D1PreparedStatement }[] = [];

  constructor(private readonly db: D1Database) {}

  add(statement: D1PreparedStatement, label?: string): this {
    this.items.push({ label, stmt: statement });
    return this;
  }

  addAll(statements: D1PreparedStatement[]): this {
    for (const s of statements) this.add(s);
    return this;
  }

  sql(sql: string, ...params: unknown[]): this {
    return this.add(stmt(this.db, sql, ...params));
  }

  get size(): number {
    return this.items.length;
  }

  async run(): Promise<BatchResult> {
    if (this.items.length === 0) return new BatchResult([], []);
    const results = await this.db.batch(this.items.map((i) => i.stmt));
    return new BatchResult(
      results,
      this.items.map((i) => i.label),
    );
  }
}

export class BatchResult {
  constructor(
    readonly results: D1Result[],
    private readonly labels: (string | undefined)[],
  ) {}

  get(label: string): D1Result {
    const i = this.labels.indexOf(label);
    if (i < 0) throw new Error(`No batch statement labelled "${label}"`);
    return this.results[i]!;
  }

  changes(label: string): number {
    return this.get(label).meta.changes ?? 0;
  }
}

/** Optimistic-concurrency guard: throws CONFLICT when a conditional UPDATE touched the wrong number of rows. */
export function assertChanges(result: D1Result, expected = 1, message?: string): void {
  const changes = result.meta.changes ?? 0;
  if (changes !== expected) throw conflict(message, `expected ${expected} changed row(s), got ${changes}`);
}

export function isUniqueViolation(err: unknown, column?: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed/i.test(msg) && (!column || msg.includes(column));
}

export function isConstraintViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /SQLITE_CONSTRAINT|constraint failed/i.test(msg);
}

/** Splits arrays for statements that bind one parameter per item (stay under MAX_BOUND_PARAMS). */
export function chunk<T>(items: T[], size = MAX_BOUND_PARAMS - 10): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** `?, ?, ?` for an IN (...) list. */
export function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/** ISO timestamp in the same format as the schema's default (`strftime('%Y-%m-%dT%H:%M:%fZ')`). */
export function isoNow(now: Date): string {
  return now.toISOString();
}
