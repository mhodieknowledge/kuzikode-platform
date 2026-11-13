import type { SupportStatus } from '../../../shared/support';

/** Pill tone per support state (R5.4): waiting for the client is the lit (gold) item, resolved is ok, open is plain ink. */
export const SUPPORT_TONE: Record<SupportStatus, 'info' | 'lit' | 'ok' | 'neutral'> = {
  open: 'info',
  awaiting_client: 'lit',
  resolved: 'ok',
  closed: 'neutral',
};
