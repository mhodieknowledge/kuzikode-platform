/** Projects (PRD §4.2 F): statuses and labels shared by the server and the admin UI. */
export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
};

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const FILE_KINDS = [
  { value: 'deliverable', label: 'Deliverable' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'internal', label: 'Internal file' },
] as const;

/**
 * Automatic progress: share of tasks done when the project has tasks, otherwise share of (non-cancelled)
 * milestones completed. Mirrors the SQL used on every write (server/modules/projects/service.ts).
 */
export function autoProgress(tasks: { status: string }[], milestones: { status: string }[]): number {
  if (tasks.length) return Math.round((100 * tasks.filter((t) => t.status === 'done').length) / tasks.length);
  const live = milestones.filter((m) => m.status !== 'cancelled');
  return live.length ? Math.round((100 * live.filter((m) => m.status === 'completed').length) / live.length) : 0;
}
