/** Support labels and tones for the admin list and conversation (R6.2 group 3). Pure, unit-tested. */
import type { Tone } from '../../primitives/display';

export const SUPPORT_TONE: Record<string, Tone> = {
  open: 'info',
  awaiting_client: 'warn',
  resolved: 'ok',
  closed: 'neutral',
};

/** Priorities worth flagging in a list row. */
export const isUrgent = (priority: string): boolean => priority === 'urgent' || priority === 'high';

/** Who wrote a message, as the conversation styles it. */
export function messageKind(m: { is_internal_note: number | boolean; user_type: string }): 'note' | 'client' | 'staff' {
  if (m.is_internal_note) return 'note';
  return m.user_type === 'client' ? 'client' : 'staff';
}
