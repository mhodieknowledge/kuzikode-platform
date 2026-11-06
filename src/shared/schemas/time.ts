/** Time tracking (P4.23, docs/12 §E.3): entries, timer, timesheet, billing unbilled time to a draft invoice. */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.');
const optId = (prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9_]+$`))
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null));
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const MAX_ENTRY_MINUTES = 24 * 60;

export const timeEntrySchema = z
  .object({
    projectId: z.string().regex(/^prj_[A-Za-z0-9_]+$/, 'Choose a project.'),
    taskId: optId('tsk'),
    entryDate: isoDate,
    minutes: z
      .number({ message: 'Enter the time spent.' })
      .int()
      .min(1, 'Enter at least one minute.')
      .max(MAX_ENTRY_MINUTES, 'One entry can be at most 24 hours.'),
    description: optText(500),
    billable: z.boolean().default(true),
    /** Hourly rate in minor units; empty uses the default rate from settings. */
    rateMinor: z
      .number()
      .int()
      .min(0)
      .max(100_000_000)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .strict();
export type TimeEntryInput = z.infer<typeof timeEntrySchema>;

export const timerStartSchema = z
  .object({
    projectId: z.string().regex(/^prj_[A-Za-z0-9_]+$/, 'Choose a project.'),
    taskId: optId('tsk'),
    description: optText(500),
    billable: z.boolean().default(true),
  })
  .strict();
export type TimerStartInput = z.infer<typeof timerStartSchema>;

export const billTimeSchema = z
  .object({
    entryIds: z
      .array(z.string().regex(/^tim_[A-Za-z0-9_]+$/))
      .min(1, 'Choose the time to bill.')
      .max(100),
  })
  .strict();

export const timeListQuery = z.object({
  projectId: z
    .string()
    .regex(/^prj_[A-Za-z0-9_]+$/)
    .optional()
    .catch(undefined),
  userId: z
    .string()
    .regex(/^usr_[A-Za-z0-9_]+$/)
    .optional()
    .catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  billing: z.enum(['unbilled', 'billed', 'non_billable']).optional().catch(undefined),
});
export type TimeListQuery = z.infer<typeof timeListQuery>;

/** Hours and minutes, e.g. 90 → "1h 30m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

/** The Monday (ISO week start) of a YYYY-MM-DD date. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
