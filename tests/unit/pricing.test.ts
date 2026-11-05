import { describe, expect, it } from 'vitest';
import { MoneyError } from '../../src/server/lib/money';
import { computeDocument, computeLine, discountAmount } from '../../src/server/lib/pricing';

describe('computeLine', () => {
  it('multiplies quantity_milli by unit price with half-even rounding', () => {
    expect(computeLine({ quantityMilli: 1000, unitPriceMinor: 75000 }).totalMinor).toBe(75000);
    expect(computeLine({ quantityMilli: 1500, unitPriceMinor: 2500 }).subtotalMinor).toBe(3750);
    // 0.333 × 1.50 = 0.4995 → 0.50 (half-even of 49.95 cents → 50)
    expect(computeLine({ quantityMilli: 333, unitPriceMinor: 150 }).subtotalMinor).toBe(50);
    // 0.005 × 1.00 = 0.5 cents → 0 (half to even)
    expect(computeLine({ quantityMilli: 5, unitPriceMinor: 100 }).subtotalMinor).toBe(0);
  });

  it('applies percent and amount discounts and never goes below zero', () => {
    const pct = computeLine({ quantityMilli: 3000, unitPriceMinor: 2500, discount: { type: 'percent', value: 1000 } });
    expect(pct).toMatchObject({ subtotalMinor: 7500, discountMinor: 750, netMinor: 6750, totalMinor: 6750 });
    const amt = computeLine({ quantityMilli: 1000, unitPriceMinor: 1000, discount: { type: 'amount', value: 5000 } });
    expect(amt).toMatchObject({ discountMinor: 1000, netMinor: 0, totalMinor: 0 });
  });

  it('computes exclusive tax on the discounted amount', () => {
    const l = computeLine({
      quantityMilli: 1000,
      unitPriceMinor: 10000,
      discount: { type: 'percent', value: 1000 },
      taxRateBp: 1550,
    });
    expect(l).toMatchObject({ netMinor: 9000, taxMinor: 1395, totalMinor: 10395 });
  });

  it('extracts inclusive tax so that net + tax = gross', () => {
    const l = computeLine({ quantityMilli: 1000, unitPriceMinor: 11550, taxRateBp: 1550, taxInclusive: true });
    expect(l).toMatchObject({ netMinor: 10000, taxMinor: 1550, totalMinor: 11550 });
    const odd = computeLine({ quantityMilli: 1000, unitPriceMinor: 999, taxRateBp: 1550, taxInclusive: true });
    expect(odd.netMinor + odd.taxMinor).toBe(999);
    expect(odd.netMinor).toBe(865); // 999 / 1.155 = 864.94 → 865
  });

  it('rejects invalid input', () => {
    expect(() => computeLine({ quantityMilli: 0, unitPriceMinor: 1 })).toThrow(MoneyError);
    expect(() => computeLine({ quantityMilli: 1000, unitPriceMinor: -1 })).toThrow(MoneyError);
    expect(() => computeLine({ quantityMilli: 1000, unitPriceMinor: 1.5 })).toThrow(MoneyError);
    expect(() => computeLine({ quantityMilli: 1000, unitPriceMinor: 1, taxRateBp: 20000 })).toThrow(MoneyError);
    expect(() => discountAmount(100, { type: 'percent', value: 10001 })).toThrow(MoneyError);
    expect(() => discountAmount(100, { type: 'amount', value: -1 })).toThrow(MoneyError);
  });
});

describe('computeDocument', () => {
  const brief = [
    { quantityMilli: 1000, unitPriceMinor: 75000 }, // Business Website
    { quantityMilli: 10000, unitPriceMinor: 3000 }, // 10 mailboxes × $30
    { quantityMilli: 3000, unitPriceMinor: 2500, discount: { type: 'percent' as const, value: 1000 } }, // 3 × $25 − 10%
  ];

  it('totals equal the sum of rounded lines (invoice editor brief: $1,117.50)', () => {
    const d = computeDocument({ lines: brief });
    expect(d.subtotalMinor).toBe(112500);
    expect(d.discountMinor).toBe(750);
    expect(d.taxMinor).toBe(0);
    expect(d.totalMinor).toBe(111750);
    expect(d.totalMinor).toBe(d.lines.reduce((s, l) => s + l.totalMinor, 0));
  });

  it('allocates a document discount across lines and keeps sums exact', () => {
    const d = computeDocument({
      lines: [
        { quantityMilli: 1000, unitPriceMinor: 3333, taxRateBp: 1550 },
        { quantityMilli: 1000, unitPriceMinor: 3333, taxRateBp: 1550 },
        { quantityMilli: 1000, unitPriceMinor: 3334, taxRateBp: 1550 },
      ],
      discount: { type: 'amount', value: 1000 },
    });
    expect(d.discountMinor).toBe(1000);
    expect(d.lines.map((l) => l.documentDiscountShareMinor).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(d.subtotalMinor - d.discountMinor + d.taxMinor).toBe(d.totalMinor);
    expect(d.taxMinor).toBe(d.lines.reduce((s, l) => s + l.taxMinor, 0));
  });

  it('caps a document discount at the post-line total', () => {
    const d = computeDocument({
      lines: [{ quantityMilli: 1000, unitPriceMinor: 500 }],
      discount: { type: 'amount', value: 9999 },
    });
    expect(d.totalMinor).toBe(0);
    expect(d.discountMinor).toBe(500);
  });

  it('applies a percent document discount after line discounts', () => {
    const d = computeDocument({ lines: brief, discount: { type: 'percent', value: 1000 } });
    // post-line total 111750, 10% = 11175
    expect(d.totalMinor).toBe(111750 - 11175);
  });

  it('handles an empty document and very large values within safe integers', () => {
    expect(computeDocument({ lines: [] }).totalMinor).toBe(0);
    const big = computeDocument({ lines: [{ quantityMilli: 1_000_000, unitPriceMinor: 9_000_000_000 }] });
    expect(big.totalMinor).toBe(9_000_000_000_000);
    expect(big.totalMinor).toBeLessThan(2 ** 53);
    expect(() =>
      computeDocument({ lines: [{ quantityMilli: 1_000_000_000, unitPriceMinor: 9_000_000_000_000 }] }),
    ).toThrow(MoneyError);
  });
});
