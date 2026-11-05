import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { auditStmt } from '../../src/server/lib/audit';
import { Batch, assertChanges, isUniqueViolation, stmt } from '../../src/server/db/client';
import { nextNumber, numberSqlExpr, sequenceStatements, raiseSequenceStatement } from '../../src/server/lib/sequences';
import { enqueue } from '../../src/server/jobs/outbox';
import { AppError } from '../../src/server/lib/errors';

const ctx = () => createContext({ env, now: () => new Date('2026-11-05T10:00:00Z') });

describe('sequences', () => {
  it('20 parallel nextNumber calls → unique and gap-free', async () => {
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () => nextNumber(env.DB, 'test:2026', 'TST-{YYYY}-{SEQ:4}', 2026)),
    );
    const seqs = numbers.map((n) => Number(n.slice(-4))).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(20);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('20 parallel batches assign unique, gap-free numbers inside the same transaction as the insert', async () => {
    const key = 'enquiry:2026';
    const expr = numberSqlExpr(key, 'ENQ-{YYYY}-{SEQ:4}', 2026);
    const insertOne = (i: number) =>
      new Batch(env.DB)
        .addAll(sequenceStatements(env.DB, key))
        .add(
          stmt(
            env.DB,
            `INSERT INTO enquiries (id, reference, name, email, category, message, consent_at)
             VALUES (?, ${expr.sql}, 'Test', 't@example.com', 'general', 'hello', '2026-11-05T10:00:00Z')`,
            `enq_par_${i}`,
            ...expr.params,
          ),
        )
        .run();
    await Promise.all(Array.from({ length: 20 }, (_, i) => insertOne(i)));
    const { results } = await env.DB.prepare(
      "SELECT reference FROM enquiries WHERE id LIKE 'enq_par_%' ORDER BY reference",
    ).all<{
      reference: string;
    }>();
    expect(results.map((r) => r.reference)).toEqual(
      Array.from({ length: 20 }, (_, i) => `ENQ-2026-${String(i + 1).padStart(4, '0')}`),
    );
  });

  it('a failed batch does not consume a number', async () => {
    const key = 'gapcheck:2026';
    const expr = numberSqlExpr(key, 'G-{SEQ:3}', 2026);
    const attempt = (id: string, email: string | null) =>
      new Batch(env.DB)
        .addAll(sequenceStatements(env.DB, key))
        .add(
          stmt(
            env.DB,
            `INSERT INTO enquiries (id, reference, name, email, category, message, consent_at)
             VALUES (?, ${expr.sql}, 'T', ?, 'general', 'm', '2026-11-05T10:00:00Z')`,
            id,
            ...expr.params,
            email,
          ),
        )
        .run();
    await attempt('enq_gap_1', 'a@example.com');
    await expect(attempt('enq_gap_2', null)).rejects.toThrow(/NOT NULL/);
    await attempt('enq_gap_3', 'c@example.com');
    const refs = await env.DB.prepare(
      "SELECT reference FROM enquiries WHERE id LIKE 'enq_gap_%' ORDER BY reference",
    ).all<{
      reference: string;
    }>();
    expect(refs.results.map((r) => r.reference)).toEqual(['G-001', 'G-002']);
  });

  it('allows raising but never lowering the next value', async () => {
    await env.DB.prepare("INSERT INTO sequences (key, next_value) VALUES ('raise:2026', 10)").run();
    await raiseSequenceStatement(env.DB, 'raise:2026', 50).run();
    await raiseSequenceStatement(env.DB, 'raise:2026', 5).run();
    const row = await env.DB.prepare("SELECT next_value FROM sequences WHERE key = 'raise:2026'").first<{
      next_value: number;
    }>();
    expect(row!.next_value).toBe(50);
  });
});

describe('batch helpers', () => {
  it('labels results and checks optimistic-concurrency guards', async () => {
    await env.DB.prepare("INSERT INTO sequences (key, next_value) VALUES ('occ', 1)").run();
    const res = await new Batch(env.DB)
      .add(stmt(env.DB, "UPDATE sequences SET next_value = 2 WHERE key = 'occ' AND next_value = 1"), 'guard')
      .run();
    expect(res.changes('guard')).toBe(1);
    const again = await new Batch(env.DB)
      .add(stmt(env.DB, "UPDATE sequences SET next_value = 2 WHERE key = 'occ' AND next_value = 1"), 'guard')
      .run();
    expect(() => assertChanges(again.get('guard'))).toThrow(AppError);
  });

  it('detects unique violations', async () => {
    await env.DB.prepare("INSERT INTO sequences (key, next_value) VALUES ('dup', 1)").run();
    try {
      await env.DB.prepare("INSERT INTO sequences (key, next_value) VALUES ('dup', 1)").run();
      expect.unreachable();
    } catch (err) {
      expect(isUniqueViolation(err, 'sequences.key')).toBe(true);
    }
  });
});

describe('audit and outbox', () => {
  it('writes a redacted audit row in the caller batch', async () => {
    const c = ctx();
    await auditStmt(c, {
      action: 'user.password_changed',
      entityType: 'user',
      entityId: 'usr_1',
      before: { passwordHash: 'pbkdf2$x', name: 'A' },
      after: { passwordHash: 'pbkdf2$y', name: 'A' },
    }).run();
    const row = await env.DB.prepare("SELECT * FROM audit_logs WHERE entity_id = 'usr_1'").first<
      Record<string, string>
    >();
    expect(row!['actor_type']).toBe('public');
    expect(row!['request_id']).toBe(c.requestId);
    expect(JSON.parse(row!['before']!)).toEqual({ passwordHash: '[REDACTED]', name: 'A' });
  });

  it('enqueues an outbox job once per idempotency key', async () => {
    const c = ctx();
    const a = enqueue(c, { type: 'email.send', payload: { to: 'x' }, idempotencyKey: 'email:welcome:usr_1' });
    const b = enqueue(c, { type: 'email.send', payload: { to: 'x' }, idempotencyKey: 'email:welcome:usr_1' });
    await env.DB.batch([a.stmt, b.stmt]);
    const n = await env.DB.prepare(
      "SELECT count(*) AS n FROM outbox WHERE idempotency_key = 'email:welcome:usr_1'",
    ).first<{ n: number }>();
    expect(n!.n).toBe(1);
  });
});
