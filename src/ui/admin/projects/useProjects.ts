/**
 * Logic of the admin project islands (R6.2 group 3), carried over unchanged from the pre-redesign
 * `components/admin/ProjectsAdmin.tsx`: endpoints, request bodies and reload-after-write behaviour are identical.
 */
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export interface Staff {
  id: string;
  name: string;
  email: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  client_visible: number;
  invoice_id: string | null;
  invoice_number: string | null;
}

export interface Task {
  id: string;
  milestone_id: string | null;
  title: string;
  assignee_id: string | null;
  assignee_name: string | null;
  status: string;
  priority: string;
  due_date: string | null;
}

export interface ProjectFormValues {
  clientId: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  budgetMinor: number | null;
  currency: string | null;
  leadId: string | null;
  memberIds: string[];
}

const api = (path: string, init: { method?: string; body?: unknown } = {}) =>
  apiFetch<{ data: { id?: string } }>(`/api/v1/admin/projects${path}`, init);

/** Create or edit a project, then open it. */
export function useProjectSave(id?: string) {
  const a = useAdminAction();
  const save = (body: Record<string, unknown>) =>
    a.run(async () => {
      if (id) {
        await api(`/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/projects/${id}`);
      } else {
        const res = await api('', { body });
        window.location.assign(`/admin/projects/${res.data.id}`);
      }
    });
  return { ...a, save };
}

/** Writes on one project record; every success reloads the page so the server-rendered lists are fresh. */
export function useProjectRecord(projectId: string) {
  const a = useAdminAction();
  const write = (path: string, init?: { method?: string; body?: unknown }) =>
    a.run(async () => {
      await api(`/${projectId}${path}`, init);
      reload();
    });
  return {
    ...a,
    saveMilestone: (m: Milestone, patch: Partial<{ status: string; clientVisible: boolean }>) =>
      write(`/milestones/${m.id}`, {
        method: 'PUT',
        body: {
          title: m.title,
          description: m.description,
          dueDate: m.due_date,
          status: patch.status ?? m.status,
          clientVisible: patch.clientVisible ?? m.client_visible === 1,
          invoiceId: m.invoice_id,
        },
      }),
    addMilestone: (f: FormData, visible: boolean) =>
      write('/milestones', {
        body: {
          title: f.get('title'),
          description: f.get('description'),
          dueDate: f.get('dueDate') || null,
          clientVisible: visible,
          invoiceId: f.get('invoiceId') || null,
        },
      }),
    deleteMilestone: (id: string) => write(`/milestones/${id}`, { method: 'DELETE' }),
    moveTask: (id: string, status: string) => write(`/tasks/${id}/move`, { body: { status } }),
    deleteTask: (id: string) => write(`/tasks/${id}`, { method: 'DELETE' }),
    addTask: (f: FormData) =>
      write('/tasks', {
        body: {
          title: f.get('title'),
          milestoneId: f.get('milestoneId') || null,
          assigneeId: f.get('assigneeId') || null,
          priority: f.get('priority'),
          dueDate: f.get('dueDate') || null,
        },
      }),
    postUpdate: (f: FormData, toClient: boolean) =>
      write('/updates', { body: { body: f.get('body'), visibility: toClient ? 'client' : 'internal' } }),
    sendMessage: (f: FormData) => write('/messages', { body: { body: f.get('body') } }),
    setFileVisibility: (id: string, clientVisible: boolean) =>
      write(`/files/${id}`, { method: 'PUT', body: { clientVisible } }),
    deleteFile: (id: string) => write(`/files/${id}`, { method: 'DELETE' }),
    uploadFile: (form: FormData) =>
      a.run(async () => {
        await apiFetch(`/api/v1/admin/projects/${projectId}/files`, { method: 'POST', body: form });
        reload();
      }),
    saveSettings: (mode: 'auto' | 'manual', f: FormData) =>
      write('/settings', {
        method: 'PUT',
        body: {
          progressMode: mode,
          ...(mode === 'manual' ? { progressPct: Number(f.get('progressPct') ?? 0) } : {}),
          internalNotes: f.get('internalNotes'),
        },
      }),
  };
}
