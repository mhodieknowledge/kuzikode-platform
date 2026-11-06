import { describe, expect, it } from 'vitest';
import { creditForQuantity, creditLimit } from '../../src/shared/credit-notes';
import { creditNoteSchema } from '../../src/shared/schemas/invoices';

describe('credit note maths (P4.10)', () => {
  const line = { quantity_milli: 3000, line_total_minor: 11_550, line_tax_minor: 1_550 };
  it('credits a whole line exactly and part of a line proportionally (half-even)', () => {
    expect(creditForQuantity(line, 3000)).toEqual({ totalMinor: 11_550, taxMinor: 1_550 });
    expect(creditForQuantity(line, 1000)).toEqual({ totalMinor: 3_850, taxMinor: 517 }); // 516.67 → 517
    expect(creditForQuantity({ quantity_milli: 3000, line_total_minor: 100, line_tax_minor: 0 }, 1500)).toEqual({
      totalMinor: 50,
      taxMinor: 0,
    });
    expect(creditForQuantity({ quantity_milli: 2000, line_total_minor: 5, line_tax_minor: 0 }, 1000).totalMinor).toBe(
      2,
    ); // 2.5 → 2
  });

  it('limits by balance (against the invoice) or by money paid (credit/refund), never above the total', () => {
    const inv = { total_minor: 10_000, amount_paid_minor: 6_000, balance_minor: 4_000 };
    expect(creditLimit(inv, { total: 0, returned: 0 }, 'invoice')).toBe(4_000);
    expect(creditLimit(inv, { total: 0, returned: 0 }, 'client_credit')).toBe(6_000);
    expect(creditLimit(inv, { total: 2_000, returned: 2_000 }, 'refund')).toBe(4_000);
    expect(creditLimit(inv, { total: 9_000, returned: 5_000 }, 'client_credit')).toBe(1_000);
    expect(
      creditLimit({ ...inv, amount_paid_minor: 0, balance_minor: 10_000 }, { total: 0, returned: 0 }, 'refund'),
    ).toBe(0);
  });

  it('validates the request', () => {
    const ok = {
      reason: 'Hosting cancelled',
      appliedTo: 'invoice',
      lines: [{ invoiceItemId: 'iit_1_0', quantity: '1.5' }],
    };
    expect(creditNoteSchema.safeParse(ok).success).toBe(true);
    expect(creditNoteSchema.safeParse({ ...ok, lines: [] }).success).toBe(false);
    expect(creditNoteSchema.safeParse({ ...ok, reason: '' }).success).toBe(false);
    expect(creditNoteSchema.safeParse({ ...ok, lines: [{ invoiceItemId: 'iit_1_0', quantity: '-1' }] }).success).toBe(
      false,
    );
    expect(creditNoteSchema.safeParse({ ...ok, lines: [{ description: 'Goodwill', amountMinor: 500 }] }).success).toBe(
      true,
    );
    expect(creditNoteSchema.safeParse({ ...ok, appliedTo: 'cash' }).success).toBe(false);
  });
});
