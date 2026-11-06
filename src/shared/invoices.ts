/**
 * Invoice lifecycle (PRD §4.2 E, §8). Shared by the server (enforcement) and the admin UI (which actions to show).
 * After issue the status is derived from the money: balance 0 → paid; past due with a balance → overdue; some money
 * received or credited → partially paid; otherwise issued. Void is terminal and needs no payments or credits applied.
 */
export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

/** Statuses that still expect money. */
export const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = ['issued', 'partially_paid', 'overdue'];

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ['issued'],
  issued: ['partially_paid', 'paid', 'overdue', 'void'],
  partially_paid: ['paid', 'overdue'],
  overdue: ['partially_paid', 'paid', 'void'],
  paid: [],
  void: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return from === to || INVOICE_TRANSITIONS[from].includes(to);
}

export interface InvoiceMoney {
  totalMinor: number;
  paidMinor: number;
  creditedMinor: number;
  dueDate: string | null;
}

export const balanceOf = (m: InvoiceMoney) => m.totalMinor - m.paidMinor - m.creditedMinor;

/** Status of an issued (non-void) invoice from its amounts and due date. `today` is a business date (YYYY-MM-DD). */
export function deriveStatus(m: InvoiceMoney, today: string): Exclude<InvoiceStatus, 'draft' | 'void'> {
  const balance = balanceOf(m);
  if (balance <= 0) return 'paid';
  if (m.dueDate && m.dueDate < today) return 'overdue';
  return m.paidMinor + m.creditedMinor > 0 ? 'partially_paid' : 'issued';
}

/** Void only before any money was applied; otherwise a credit note corrects the invoice. */
export const canVoid = (status: InvoiceStatus, paidMinor: number, creditedMinor: number) =>
  (status === 'issued' || status === 'overdue') && paidMinor === 0 && creditedMinor === 0;

// ---------------------------------------------------------------- reminders

export const DEFAULT_REMINDER_SCHEDULE = [-3, 0, 7, 14];

/** "-3, 0, 7, 14" → [-3, 0, 7, 14] (days relative to the due date, sorted, unique, within ±90). Invalid → default. */
export function parseReminderSchedule(value: unknown): number[] {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_REMINDER_SCHEDULE;
  const parts = value.split(',').map((p) => p.trim());
  if (!parts.every((p) => /^[+-]?\d{1,2}$/.test(p))) return DEFAULT_REMINDER_SCHEDULE;
  const days = [...new Set(parts.map(Number))].filter((d) => d >= -90 && d <= 90).sort((a, b) => a - b);
  return days.length ? days.slice(0, 8) : DEFAULT_REMINDER_SCHEDULE;
}

/** Reminder key for an offset: `before_3`, `due`, `after_7`. Unique per invoice, so each is sent at most once. */
export const reminderKind = (offset: number) =>
  offset === 0 ? 'due' : offset < 0 ? `before_${-offset}` : `after_${offset}`;

/**
 * The reminder due today for an invoice `daysPastDue` days after its due date (negative before): the latest offset
 * already reached. Missed earlier offsets are skipped rather than sent in a burst.
 */
export function reminderOffsetFor(schedule: number[], daysPastDue: number): number | null {
  const reached = schedule.filter((o) => o <= daysPastDue);
  return reached.length ? reached[reached.length - 1]! : null;
}

// ---------------------------------------------------------------- manual payments

export const MANUAL_PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'ecocash', label: 'EcoCash (manual)' },
  { value: 'onemoney', label: 'OneMoney (manual)' },
  { value: 'innbucks', label: 'InnBucks (manual)' },
  { value: 'card', label: 'Card (manual)' },
  { value: 'other', label: 'Other' },
] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]['value'];
