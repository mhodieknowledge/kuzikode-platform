import { describe, expect, it } from 'vitest';
import { canTransition, QUOTATION_STATUSES, QUOTATION_TRANSITIONS } from '../../src/shared/quotations';
import { quotationSchema, respondSchema } from '../../src/shared/schemas/quotations';

const allowed: [string, string][] = [
  ['draft', 'sent'],
  ['draft', 'void'],
  ['sent', 'sent'],
  ['sent', 'viewed'],
  ['sent', 'accepted'],
  ['sent', 'rejected'],
  ['sent', 'expired'],
  ['sent', 'void'],
  ['viewed', 'sent'],
  ['viewed', 'accepted'],
  ['viewed', 'rejected'],
  ['viewed', 'expired'],
  ['viewed', 'void'],
  ['accepted', 'void'],
  ['rejected', 'void'],
  ['expired', 'void'],
];

describe('quotation state machine', () => {
  it('allows exactly the listed transitions', () => {
    for (const from of QUOTATION_STATUSES)
      for (const to of QUOTATION_STATUSES) {
        const ok = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(ok);
      }
    expect(QUOTATION_TRANSITIONS.void).toEqual([]);
  });
});

describe('quotation schemas', () => {
  const base = {
    clientId: 'cli_1',
    title: 'Website',
    currency: 'USD',
    items: [{ description: 'Design', quantity: '1.5', unitPriceMinor: 1000 }],
  };
  it('accepts a minimal quotation and rejects bad quantities, percentages and unknown keys', () => {
    expect(quotationSchema.safeParse(base).success).toBe(true);
    expect(quotationSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: '0' }] }).success).toBe(false);
    expect(quotationSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: '1.0001' }] }).success).toBe(
      false,
    );
    expect(quotationSchema.safeParse({ ...base, discountType: 'percent', discountValue: 10_001 }).success).toBe(false);
    expect(quotationSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(quotationSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
  it('acceptance needs a name and the confirmation; rejection does not', () => {
    expect(respondSchema.safeParse({ decision: 'accept', name: 'Ann Moyo' }).success).toBe(false);
    expect(respondSchema.safeParse({ decision: 'accept', name: 'Ann Moyo', agree: true }).success).toBe(true);
    expect(respondSchema.safeParse({ decision: 'reject' }).success).toBe(true);
  });
});
