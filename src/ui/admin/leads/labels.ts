/** Lead display tones (R6.2). Labels come from the leads module (LEAD_STATUS_LABEL). */
import type { Tone } from '../../primitives/display';

export const LEAD_STATUS_TONE: Record<string, Tone> = {
  new: 'lit',
  contacted: 'neutral',
  qualified: 'info',
  proposal_sent: 'warn',
  won: 'ok',
  lost: 'neutral',
};

export const LEAD_SOURCE_LABEL = {
  website: 'Website',
  referral: 'Referral',
  manual: 'Added by staff',
  social: 'Social media',
  other: 'Other',
} as const;
