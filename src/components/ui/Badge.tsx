import type { ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-950/5 text-ink-800',
  info: 'bg-info-50 text-info-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  brand: 'bg-brand-50 text-brand-600',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  strike,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  strike?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
        strike && 'line-through',
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** One status → tone/label map per entity (docs/05 §5). Status always shows a text label, never colour alone. */
export const STATUS_MAPS: Record<string, Record<string, { tone: Tone; label: string; strike?: boolean }>> = {
  invoice: {
    draft: { tone: 'neutral', label: 'Draft' },
    issued: { tone: 'info', label: 'Issued' },
    partially_paid: { tone: 'warning', label: 'Partially paid' },
    paid: { tone: 'success', label: 'Paid' },
    overdue: { tone: 'danger', label: 'Overdue' },
    void: { tone: 'neutral', label: 'Void', strike: true },
  },
  quotation: {
    draft: { tone: 'neutral', label: 'Draft' },
    sent: { tone: 'info', label: 'Sent' },
    viewed: { tone: 'brand', label: 'Viewed' },
    accepted: { tone: 'success', label: 'Accepted' },
    rejected: { tone: 'danger', label: 'Rejected' },
    expired: { tone: 'warning', label: 'Expired' },
    void: { tone: 'neutral', label: 'Void', strike: true },
  },
  payment_attempt: {
    created: { tone: 'neutral', label: 'Created' },
    initiated: { tone: 'info', label: 'Initiated' },
    pending: { tone: 'info', label: 'Pending' },
    partially_paid: { tone: 'warning', label: 'Partially paid' },
    succeeded: { tone: 'success', label: 'Succeeded' },
    disputed: { tone: 'danger', label: 'Disputed' },
    refunded: { tone: 'warning', label: 'Refunded' },
    failed: { tone: 'danger', label: 'Failed' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    expired: { tone: 'neutral', label: 'Expired' },
    reversed: { tone: 'danger', label: 'Reversed' },
    error: { tone: 'danger', label: 'Needs review' },
  },
  project: {
    planning: { tone: 'neutral', label: 'Planning' },
    active: { tone: 'info', label: 'Active' },
    on_hold: { tone: 'warning', label: 'On hold' },
    completed: { tone: 'success', label: 'Completed' },
    cancelled: { tone: 'neutral', label: 'Cancelled', strike: true },
  },
  lead: {
    new: { tone: 'brand', label: 'New' },
    contacted: { tone: 'info', label: 'Contacted' },
    qualified: { tone: 'info', label: 'Qualified' },
    proposal_sent: { tone: 'warning', label: 'Proposal sent' },
    won: { tone: 'success', label: 'Won' },
    lost: { tone: 'neutral', label: 'Lost' },
  },
  support: {
    open: { tone: 'info', label: 'Open' },
    awaiting_client: { tone: 'warning', label: 'Awaiting client' },
    resolved: { tone: 'success', label: 'Resolved' },
    closed: { tone: 'neutral', label: 'Closed' },
  },
};

export function StatusBadge({
  entity,
  status,
  className,
}: {
  entity: keyof typeof STATUS_MAPS | string;
  status: string;
  className?: string;
}) {
  const m = STATUS_MAPS[entity]?.[status] ?? { tone: 'neutral' as Tone, label: status.replace(/_/g, ' ') };
  return (
    <Badge tone={m.tone} strike={m.strike ?? false} {...(className ? { className } : {})}>
      {m.label}
    </Badge>
  );
}
