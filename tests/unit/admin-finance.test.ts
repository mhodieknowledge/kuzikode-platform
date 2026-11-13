import { describe, expect, it } from 'vitest';
import { activeFilters, type FilterField } from '../../src/ui/admin/FilterBar';
import { attemptStatus, formatWhen, reminderLabel, PAYMENT_METHOD } from '../../src/ui/admin/finance/labels';
import {
  availableApplications,
  creditNoteBody,
  creditTotal,
  safeQty,
  type CreditOptions,
} from '../../src/ui/admin/invoices/useInvoices';
import { toggleIn } from '../../src/ui/admin/payments/useGateways';

const options: CreditOptions = {
  lines: [
    {
      id: 'l1',
      description: 'Site',
      quantity_milli: 2000,
      remaining_milli: 2000,
      line_total_minor: 20000,
      line_tax_minor: 0,
    },
  ],
  limits: { invoice: 5000, client_credit: 0, refund: 0 } as CreditOptions['limits'],
};

describe('admin finance helpers (R6.2 group 2)', () => {
  it('counts a filled date filter as active', () => {
    const f: FilterField[] = [
      { kind: 'date', name: 'from', label: 'From', value: '2026-01-01' },
      { kind: 'date', name: 'to', label: 'To', value: '' },
    ];
    expect(activeFilters(f)).toBe(1);
  });
  it('maps attempt statuses and falls back to the raw value', () => {
    expect(attemptStatus('pending')).toEqual({ label: 'Waiting', tone: 'info' });
    expect(attemptStatus('weird').label).toBe('weird');
  });
  it('labels reminders and methods', () => {
    expect(reminderLabel('due')).toBe('On the due date');
    expect(reminderLabel('before_7')).toBe('7 days before due');
    expect(reminderLabel('after_14')).toBe('14 days overdue');
    expect(PAYMENT_METHOD['bank_transfer']).toBe('Bank transfer');
    expect(formatWhen(null)).toBe('');
  });
  it('parses credit quantities safely', () => {
    expect(safeQty('')).toBe(0);
    expect(safeQty('1.5')).toBe(1500);
    expect(safeQty('abc')).toBeNull();
  });
  it('offers only applications with a limit and totals the credit', () => {
    expect(availableApplications(options).map((a) => a.value)).toEqual(['invoice']);
    expect(creditTotal(options.lines, { l1: '1' }, null)).toBeGreaterThan(0);
    expect(creditTotal(options.lines, { l1: '9' }, 250)).toBe(250); // over the remaining quantity is ignored
  });
  it('builds the credit-note body from entered lines and the adjustment', () => {
    const body = creditNoteBody(options.lines, { l1: ' 1 ' }, { minor: 500, text: 'Goodwill' }, 'invoice', 'Late');
    expect(body.lines).toEqual([
      { invoiceItemId: 'l1', quantity: '1' },
      { description: 'Goodwill', amountMinor: 500 },
    ]);
    expect(body.reason).toBe('Late');
  });
  it('toggles list membership', () => {
    expect(toggleIn(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleIn(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});
