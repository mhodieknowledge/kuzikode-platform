import { describe, expect, it } from 'vitest';
import {
  INVOICE_STATUSES,
  INVOICE_TRANSITIONS,
  balanceOf,
  canTransition,
  canVoid,
  deriveStatus,
  parseReminderSchedule,
  reminderKind,
  reminderOffsetFor,
  DEFAULT_REMINDER_SCHEDULE,
} from '../../src/shared/invoices';
import { invoiceSchema, manualPaymentSchema } from '../../src/shared/schemas/invoices';

const m = (paid: number, credited = 0, dueDate: string | null = '2026-11-20') => ({
  totalMinor: 10_000,
  paidMinor: paid,
  creditedMinor: credited,
  dueDate,
});

describe('invoice state machine (docs/08 §2)', () => {
  it('allows exactly the listed transitions', () => {
    for (const from of INVOICE_STATUSES)
      for (const to of INVOICE_STATUSES) {
        const allowed = from === to || INVOICE_TRANSITIONS[from].includes(to);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(allowed);
      }
    expect(canTransition('draft', 'paid')).toBe(false);
    expect(canTransition('paid', 'void')).toBe(false);
    expect(canTransition('void', 'issued')).toBe(false);
    expect(canTransition('partially_paid', 'void')).toBe(false);
  });

  it('derives the status from the money and the due date', () => {
    const today = '2026-11-10';
    expect(deriveStatus(m(0), today)).toBe('issued');
    expect(deriveStatus(m(2_500), today)).toBe('partially_paid');
    expect(deriveStatus(m(0, 2_500), today)).toBe('partially_paid');
    expect(deriveStatus(m(10_000), today)).toBe('paid');
    expect(deriveStatus(m(7_500, 2_500), today)).toBe('paid');
    expect(deriveStatus(m(2_500, 0, '2026-11-09'), today)).toBe('overdue');
    expect(deriveStatus(m(0, 0, '2026-11-10'), today)).toBe('issued'); // due today is not overdue yet
    expect(deriveStatus({ totalMinor: 0, paidMinor: 0, creditedMinor: 0, dueDate: null }, today)).toBe('paid');
    expect(balanceOf(m(2_500, 1_000))).toBe(6_500);
  });

  it('voids only issued or overdue invoices with no money applied', () => {
    expect(canVoid('issued', 0, 0)).toBe(true);
    expect(canVoid('overdue', 0, 0)).toBe(true);
    expect(canVoid('issued', 1, 0)).toBe(false);
    expect(canVoid('overdue', 0, 1)).toBe(false);
    expect(canVoid('draft', 0, 0)).toBe(false);
    expect(canVoid('paid', 0, 0)).toBe(false);
    expect(canVoid('void', 0, 0)).toBe(false);
  });
});

describe('reminder schedule', () => {
  it('parses, sorts and de-duplicates, falling back to the default', () => {
    expect(parseReminderSchedule('14, -3, 0, 7, 7')).toEqual([-3, 0, 7, 14]);
    expect(parseReminderSchedule('+5,1')).toEqual([1, 5]);
    expect(parseReminderSchedule('')).toEqual(DEFAULT_REMINDER_SCHEDULE);
    expect(parseReminderSchedule('soon')).toEqual(DEFAULT_REMINDER_SCHEDULE);
    expect(parseReminderSchedule(undefined)).toEqual(DEFAULT_REMINDER_SCHEDULE);
  });

  it('picks the latest reached offset and names it uniquely', () => {
    const s = [-3, 0, 7, 14];
    expect(reminderOffsetFor(s, -5)).toBeNull();
    expect(reminderOffsetFor(s, -3)).toBe(-3);
    expect(reminderOffsetFor(s, -1)).toBe(-3);
    expect(reminderOffsetFor(s, 0)).toBe(0);
    expect(reminderOffsetFor(s, 10)).toBe(7);
    expect(reminderOffsetFor(s, 40)).toBe(14);
    expect([-3, 0, 7].map(reminderKind)).toEqual(['before_3', 'due', 'after_7']);
  });
});

describe('invoice schemas', () => {
  const line = { description: 'Work', quantity: '1', unitPriceMinor: 100 };
  const base = { clientId: 'cli_1', currency: 'USD', items: [line] };
  it('accepts a minimal draft and rejects recurring lines and a due date before issue', () => {
    expect(invoiceSchema.safeParse(base).success).toBe(true);
    const rec = invoiceSchema.safeParse({
      ...base,
      items: [{ ...line, isRecurring: true, recurringInterval: 'month' }],
    });
    expect(rec.success).toBe(false);
    const dates = invoiceSchema.safeParse({ ...base, issueDate: '2026-11-10', dueDate: '2026-11-01' });
    expect(dates.success).toBe(false);
  });
  it('validates manual payments', () => {
    const ok = { amountMinor: 500, method: 'bank_transfer', receivedOn: '2026-11-06' };
    expect(manualPaymentSchema.safeParse(ok).success).toBe(true);
    expect(manualPaymentSchema.safeParse({ ...ok, amountMinor: 0 }).success).toBe(false);
    expect(manualPaymentSchema.safeParse({ ...ok, method: 'paynow' }).success).toBe(false);
    expect(manualPaymentSchema.safeParse({ ...ok, amountMinor: 1.5 }).success).toBe(false);
  });
});
