/**
 * Project labels, tones and small formatters for the admin lists and detail pages (R6.2 group 3). Pure, unit-tested.
 * Labels the e2e specs read stay as before.
 */
import type { Tone } from '../../primitives/display';

export const PROJECT_STATUS_TONE: Record<string, Tone> = {
  planning: 'info',
  active: 'lit',
  on_hold: 'warn',
  completed: 'ok',
  cancelled: 'neutral',
};

/** What each audit action in a project's activity feed reads as. */
export const PROJECT_ACTION_LABEL: Record<string, string> = {
  'project.created': 'Project created',
  'project.created_from_quotation': 'Created from the quotation',
  'project.updated': 'Details changed',
  'project.settings_changed': 'Progress or notes changed',
  'project.milestone_added': 'Milestone added',
  'project.milestone_updated': 'Milestone updated',
  'project.milestone_deleted': 'Milestone deleted',
  'project.task_added': 'Task added',
  'project.task_updated': 'Task updated',
  'project.task_moved': 'Task moved',
  'project.task_deleted': 'Task deleted',
  'project.update_posted': 'Update posted',
  'project.file_added': 'File added',
  'project.file_visibility': 'File visibility changed',
  'project.file_deleted': 'File deleted',
};

export const PRIORITY_LABEL: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

/** "320 KB" / "1.4 MB" for an uploaded file. */
export const fileSize = (n: number): string =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/** Medium date + time in Harare time (mono timestamps in feeds and conversations). */
export const harareStamp = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Harare' }).format(
    new Date(iso),
  );

/** Task's meta line: assignee, due date, non-default priority, milestone. */
export function taskMeta(
  t: { assignee_name: string | null; due_date: string | null; priority: string },
  milestone: string | undefined,
): string {
  return [
    t.assignee_name ?? 'Unassigned',
    t.due_date ? `due ${t.due_date}` : null,
    t.priority !== 'normal' ? t.priority : null,
    milestone ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Milestone's meta line: due date, visibility, linked invoice. */
export function milestoneMeta(m: {
  due_date: string | null;
  client_visible: number;
  invoice_number: string | null;
}): string {
  return [
    m.due_date ? `Due ${m.due_date}` : 'No due date',
    m.client_visible ? 'visible to the client' : 'internal',
    m.invoice_number,
  ]
    .filter(Boolean)
    .join(' · ');
}
