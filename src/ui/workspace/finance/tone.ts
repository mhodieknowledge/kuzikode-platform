/**
 * Maps the shared portal status tones (src/shared/portal.ts) to the StatusPill tones of the new UI: waiting on the client is gold
 * (lit), settled is ok, part paid or expired is warn, overdue is danger (clay), closed is neutral.
 */
export type PillTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'lit';

const MAP: Record<string, PillTone> = {
  info: 'lit',
  success: 'ok',
  warning: 'warn',
  danger: 'danger',
  neutral: 'neutral',
};

export const pillTone = (tone: string): PillTone => MAP[tone] ?? 'neutral';
