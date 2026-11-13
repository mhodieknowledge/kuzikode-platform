/**
 * Finance labels and status tones for admin lists and heads (R6.2 group 2): invoices, payments and gateway attempts,
 * subscriptions, managed services. Labels the e2e specs read ("Partially paid", "Waiting", "Paused") stay as before.
 */
import { MANUAL_PAYMENT_METHODS } from '../../../shared/invoices';
import type { Tone } from '../../primitives/display';

export const INVOICE_STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  issued: 'info',
  partially_paid: 'warn',
  paid: 'ok',
  overdue: 'danger',
  void: 'neutral',
};

/** Invoice statuses that are open for payment. */
export const OPEN_BALANCE_STATUSES = ['issued', 'partially_paid', 'overdue'];

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  completed: { label: 'Completed', tone: 'ok' },
  partially_refunded: { label: 'Part refunded', tone: 'warn' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  reversed: { label: 'Reversed', tone: 'danger' },
};

export const PAYMENT_PROVIDER: Record<string, string> = {
  manual: 'Recorded manually',
  paynow: 'Paynow',
  pesepay: 'PesePay',
  mock: 'Test provider',
};

/** Manual payment method labels without the "(manual)" suffix. */
export const PAYMENT_METHOD: Record<string, string> = Object.fromEntries(
  MANUAL_PAYMENT_METHODS.map((m) => [m.value, m.label.replace(' (manual)', '')]),
);

/** Online payment attempt statuses (label and tone), as the invoice page shows them. */
export const ATTEMPT_STATUS: Record<string, { label: string; tone: Tone }> = {
  created: { label: 'Starting', tone: 'neutral' },
  initiated: { label: 'Waiting', tone: 'info' },
  pending: { label: 'Waiting', tone: 'info' },
  partially_paid: { label: 'Part paid', tone: 'warn' },
  succeeded: { label: 'Paid', tone: 'ok' },
  disputed: { label: 'Disputed', tone: 'warn' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  reversed: { label: 'Reversed', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  error: { label: 'Error', tone: 'danger' },
};

export const attemptStatus = (s: string): { label: string; tone: Tone } =>
  ATTEMPT_STATUS[s] ?? { label: s, tone: 'neutral' };

export const SUBSCRIPTION_STATUS: Record<string, { label: string; long: string; tone: Tone }> = {
  active: { label: 'Active', long: 'Active', tone: 'ok' },
  at_risk: { label: 'At risk', long: 'At risk: an invoice is long overdue', tone: 'danger' },
  paused: { label: 'Paused', long: 'Paused', tone: 'warn' },
  cancelled: { label: 'Cancelled', long: 'Cancelled', tone: 'neutral' },
  ended: { label: 'Ended', long: 'Ended', tone: 'neutral' },
};

export const ASSET_STATUS_TONE: Record<string, Tone> = {
  active: 'ok',
  expired: 'danger',
  cancelled: 'neutral',
  transferred: 'neutral',
};

/** "30 Jan 2026, 14:05" in the business time zone. */
export const formatWhen = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Harare' }).format(
        new Date(iso),
      )
    : '';

/** Reminder kinds on an invoice: `before_7`, `due`, `after_14`. */
export function reminderLabel(kind: string): string {
  if (kind === 'due') return 'On the due date';
  if (kind.startsWith('before_')) return `${kind.slice(7)} days before due`;
  return `${kind.slice(6)} days overdue`;
}
