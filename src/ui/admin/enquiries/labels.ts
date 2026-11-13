/** Enquiry display labels and status tones for the admin inbox (R6.2). */
import type { Tone } from '../../primitives/display';

export const ENQUIRY_KIND_LABEL = {
  contact: 'Contact form',
  wizard: 'Project request',
  consultation: 'Consultation',
  product_interest: 'Product interest',
} as const;

export const ENQUIRY_STATUS_LABEL = { new: 'New', triaged: 'Lead created', spam: 'Spam', closed: 'Closed' } as const;

export const ENQUIRY_STATUS_TONE: Record<keyof typeof ENQUIRY_STATUS_LABEL, Tone> = {
  new: 'lit',
  triaged: 'ok',
  spam: 'danger',
  closed: 'neutral',
};
