import { describe, expect, it } from 'vitest';
import { buildManifest, compareManifests, countsSql } from '../../scripts/d1-manifest.mjs';
import { planSecrets } from '../../scripts/prod-secrets.mjs';

describe('production secrets plan', () => {
  it('first deploy: generates the internal keys and takes third-party keys from the environment', () => {
    const plan = planSecrets([], { TURNSTILE_SECRET_KEY: 'ts', RESEND_API_KEY: 're', PAYNOW_USD_INTEGRATION_ID: '' });
    expect(plan.generated).toEqual(['HMAC_SECRET', 'DATA_ENCRYPTION_KEY']);
    expect(plan.updated).toEqual(['TURNSTILE_SECRET_KEY', 'RESEND_API_KEY']);
    expect(plan.missing).toEqual([]);
    expect(Buffer.from(plan.secrets.DATA_ENCRYPTION_KEY!, 'base64')).toHaveLength(32);
    expect(plan.secrets.HMAC_SECRET!.length).toBeGreaterThanOrEqual(64);
    expect(plan.secrets).not.toHaveProperty('PAYNOW_USD_INTEGRATION_ID');
  });

  it('never regenerates a key the Worker already has', () => {
    const plan = planSecrets(['HMAC_SECRET', 'DATA_ENCRYPTION_KEY', 'TURNSTILE_SECRET_KEY'], {});
    expect(plan.secrets).toEqual({});
    expect(plan.generated).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('reports a required third-party secret that is nowhere', () => {
    expect(planSecrets([], {}).missing).toEqual(['TURNSTILE_SECRET_KEY']);
  });
});

describe('backup manifest', () => {
  const db: Record<string, Record<string, unknown>[]> = {
    tables: [{ name: 'clients' }, { name: 'invoices' }, { name: 'payments' }],
  };
  const fakeQuery = (counts: Record<string, number>, invoices: unknown[]) => (sql: string) => {
    if (sql.includes('sqlite_master')) return db.tables!;
    if (sql.includes('(SELECT count(*)')) return [counts];
    if (sql.includes('FROM invoices')) return invoices as Record<string, unknown>[];
    return [];
  };

  it('counts with a single SELECT (D1 allows at most 5 compound terms) and refuses odd names', () => {
    expect(countsSql(['a', 'b'])).toBe('SELECT (SELECT count(*) FROM "a") AS "a", (SELECT count(*) FROM "b") AS "b"');
    expect(countsSql(['a', 'b'])).not.toMatch(/UNION/);
    expect(() => countsSql(['x"; DROP TABLE y; --'])).toThrow();
  });

  it('matches an identical restore and lists every difference otherwise', () => {
    const inv = [{ currency: 'USD', n: 2, total_minor: 15000, paid_minor: 5000 }];
    const expected = buildManifest('kuzikode-prod-db', fakeQuery({ clients: 3, invoices: 2, payments: 1 }, inv));
    const same = buildManifest('kuzikode-restore-test', fakeQuery({ clients: 3, invoices: 2, payments: 1 }, inv));
    expect(compareManifests(expected, same)).toEqual([]);

    const broken = buildManifest(
      'kuzikode-restore-test',
      fakeQuery({ clients: 2, invoices: 2, payments: 1 }, [{ ...inv[0], total_minor: 14999 }]),
    );
    const diffs = compareManifests(expected, broken);
    expect(diffs).toHaveLength(2);
    expect(diffs[0]).toBe('table clients: 2 rows, expected 3');
    expect(diffs[1]).toMatch(/^checksum invoices differs/);
  });
});
