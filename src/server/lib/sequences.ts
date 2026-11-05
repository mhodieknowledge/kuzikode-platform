/**
 * Document numbering (PRD §8). Formats use tokens {YYYY}, {YY}, {SEQ} and {SEQ:n} (zero-padded to n digits).
 * Formats containing a year token get one sequence per year (`invoice:2026`); others use a single key (`client`).
 *
 * Gap-free use: put `sequenceStatements()` and a statement using `numberSqlExpr()` in the SAME db.batch(). D1 runs a
 * batch as one transaction, so the bump and the number assignment commit together or not at all.
 */
import { stmt } from '../db/client';

export interface ParsedFormat {
  prefix: string;
  suffix: string;
  width: number;
  yearly: boolean;
}

const SEQ = /\{SEQ(?::(\d{1,2}))?\}/;

export function parseFormat(format: string, year: number): ParsedFormat {
  const m = SEQ.exec(format);
  if (!m || format.match(new RegExp(SEQ.source, 'g'))!.length !== 1) {
    throw new Error('Number format must contain exactly one {SEQ} or {SEQ:n} token');
  }
  const yearly = /\{YYYY\}|\{YY\}/.test(format);
  const sub = (s: string) => s.replace(/\{YYYY\}/g, String(year)).replace(/\{YY\}/g, String(year).slice(-2));
  const width = m[1] ? Number(m[1]) : 1;
  if (width < 1 || width > 12) throw new Error('Sequence width must be between 1 and 12');
  return { prefix: sub(format.slice(0, m.index)), suffix: sub(format.slice(m.index + m[0].length)), width, yearly };
}

export function renderNumber(format: string, year: number, seq: number): string {
  const p = parseFormat(format, year);
  return `${p.prefix}${String(seq).padStart(p.width, '0')}${p.suffix}`;
}

/** e.g. sequenceKey('invoice', 'INV-{YYYY}-{SEQ:5}', 2026) → 'invoice:2026'. */
export function sequenceKey(kind: string, format: string, year: number): string {
  return parseFormat(format, year).yearly ? `${kind}:${year}` : kind;
}

/** Statements that ensure the sequence row exists and bump it. Must precede the statement using numberSqlExpr(). */
export function sequenceStatements(db: D1Database, key: string): D1PreparedStatement[] {
  return [
    stmt(db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key),
    stmt(db, 'UPDATE sequences SET next_value = next_value + 1 WHERE key = ?', key),
  ];
}

/** SQL expression (+ params) yielding the number just allocated by sequenceStatements() in the same batch. */
export function numberSqlExpr(key: string, format: string, year: number): { sql: string; params: unknown[] } {
  const p = parseFormat(format, year);
  return {
    sql: `(? || printf('%0${p.width}d', (SELECT next_value - 1 FROM sequences WHERE key = ?)) || ?)`,
    params: [p.prefix, key, p.suffix],
  };
}

/**
 * Allocates and returns the next number immediately (atomic UPDATE … RETURNING). A number is consumed even if the
 * caller's later write fails, so use the batch form for financial documents.
 */
export async function nextNumber(db: D1Database, key: string, format: string, year: number): Promise<string> {
  const [, res] = await db.batch<{ value: number }>([
    stmt(db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key),
    stmt(db, 'UPDATE sequences SET next_value = next_value + 1 WHERE key = ? RETURNING next_value - 1 AS value', key),
  ]);
  const value = res?.results[0]?.value;
  if (typeof value !== 'number') throw new Error(`Sequence ${key} did not return a value`);
  return renderNumber(format, year, value);
}

/** Raising the next value is allowed, lowering it is not (PRD §4.2 K). */
export function raiseSequenceStatement(db: D1Database, key: string, nextValue: number): D1PreparedStatement {
  return stmt(
    db,
    'INSERT INTO sequences (key, next_value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET next_value = excluded.next_value WHERE excluded.next_value >= sequences.next_value',
    key,
    nextValue,
  );
}
