/** Quotation status tones for admin lists and heads (R6.2). Labels come from src/shared/quotations. */
import type { Tone } from '../../primitives/display';

export const QUOTATION_STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  sent: 'info',
  viewed: 'lit',
  accepted: 'ok',
  rejected: 'danger',
  expired: 'warn',
  void: 'neutral',
};
