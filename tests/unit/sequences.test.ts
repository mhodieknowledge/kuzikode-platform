import { describe, expect, it } from 'vitest';
import { parseFormat, renderNumber, sequenceKey } from '../../src/server/lib/sequences';
import { addDays, addMonths, businessDate, businessYear, daysBetween, isValidDate } from '../../src/server/lib/dates';
import { likePattern, orderBy } from '../../src/server/lib/pagination';

describe('number formats', () => {
  it.each([
    ['INV-{YYYY}-{SEQ:5}', 2026, 1, 'INV-2026-00001'],
    ['QUO-{YYYY}-{SEQ:4}', 2026, 123, 'QUO-2026-0123'],
    ['CL-{SEQ:4}', 2026, 7, 'CL-0007'],
    ['RCT{YY}/{SEQ}', 2027, 42, 'RCT27/42'],
    ['INV-{YYYY}-{SEQ:2}', 2026, 1234, 'INV-2026-1234'],
  ])('%s year %i seq %i → %s', (format, year, seq, expected) => expect(renderNumber(format, year, seq)).toBe(expected));

  it('uses a per-year sequence when the format has a year (rollover)', () => {
    expect(sequenceKey('invoice', 'INV-{YYYY}-{SEQ:5}', 2026)).toBe('invoice:2026');
    expect(sequenceKey('invoice', 'INV-{YYYY}-{SEQ:5}', 2027)).toBe('invoice:2027');
    expect(sequenceKey('client', 'CL-{SEQ:4}', 2026)).toBe('client');
  });

  it('rejects formats without exactly one sequence token', () => {
    expect(() => parseFormat('INV-{YYYY}', 2026)).toThrow();
    expect(() => parseFormat('{SEQ}-{SEQ}', 2026)).toThrow();
  });
});

describe('dates', () => {
  it('uses Africa/Harare for business dates and year rollover', () => {
    expect(businessDate(new Date('2026-12-31T21:59:00Z'))).toBe('2026-12-31');
    expect(businessDate(new Date('2026-12-31T22:00:00Z'))).toBe('2027-01-01');
    expect(businessYear(new Date('2026-12-31T22:30:00Z'))).toBe(2027);
  });

  it('adds days and months safely', () => {
    expect(addDays('2026-11-05', 14)).toBe('2026-11-19');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 12)).toBe('2027-11-15');
    expect(daysBetween('2026-11-19', '2026-12-03')).toBe(14);
    expect(isValidDate('2026-02-30')).toBe(false);
  });
});

describe('pagination helpers', () => {
  const allowed = { created_at: 'i.created_at', number: 'i.number', total: 'i.total_minor' };
  it('builds ORDER BY from an allow-list only', () => {
    expect(orderBy('-created_at', allowed, 'i.created_at DESC')).toBe('ORDER BY i.created_at DESC, i.id DESC');
    expect(orderBy('number', allowed, 'x')).toBe('ORDER BY i.number ASC, i.id ASC');
    expect(orderBy('password_hash; DROP TABLE users', allowed, 'i.created_at DESC')).toBe('ORDER BY i.created_at DESC');
    expect(orderBy(undefined, allowed, 'i.created_at DESC')).toBe('ORDER BY i.created_at DESC');
  });

  it('escapes LIKE wildcards', () => {
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});
