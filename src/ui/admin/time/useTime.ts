/**
 * Logic of the admin time islands (R6.2 group 3), carried over unchanged from the pre-redesign `components/admin/TimeAdmin.tsx`:
 * timer start / stop / discard, entry create / edit / delete and billing unbilled time to a draft invoice.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

const api = (path: string, init: { method?: string; body?: unknown } = {}) =>
  apiFetch<{ data: Record<string, unknown> | null }>(`/api/v1/admin/time${path}`, init);

export interface ProjectOption {
  id: string;
  label: string;
  tasks: { id: string; title: string }[];
}

export interface EntryValues {
  id?: string;
  projectId: string;
  taskId: string | null;
  entryDate: string;
  minutes: number;
  description: string | null;
  billable: boolean;
}

export interface UnbilledEntry {
  id: string;
  entry_date: string;
  user_name: string;
  task_title: string | null;
  description: string | null;
  minutes: number;
  amountLabel: string;
  currency: string;
}

/** Minutes elapsed since an ISO start time, refreshed every 15 s while a timer runs. */
export function useElapsedMinutes(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000)) : 0;
}

export function useTimer() {
  const a = useAdminAction();
  const call = (path: string, body: unknown) =>
    a.run(async () => {
      await api(path, { method: 'POST', body });
      reload();
    });
  return {
    ...a,
    start: (v: { projectId: string; taskId: string | null; description: string }) =>
      call('/timer/start', { ...v, billable: true }),
    stop: () => call('/timer/stop', {}),
    discard: () => call('/timer/discard', {}),
  };
}

/** Hours + minutes from the form to whole minutes. */
export const toMinutes = (hours: unknown, mins: unknown): number =>
  Math.round(Number(hours || 0) * 60 + Number(mins || 0));

export function useEntrySave(entryId?: string) {
  const a = useAdminAction();
  return {
    ...a,
    save: (f: FormData, v: { projectId: string; taskId: string | null; billable: boolean }) =>
      a.run(async () => {
        await api(entryId ? `/entries/${entryId}` : '/entries', {
          method: entryId ? 'PUT' : 'POST',
          body: {
            projectId: v.projectId,
            taskId: v.taskId,
            entryDate: f.get('entryDate'),
            minutes: toMinutes(f.get('hours'), f.get('mins')),
            description: f.get('description'),
            billable: v.billable,
          },
        });
        reload();
      }),
    remove: async () => {
      await api(`/entries/${entryId}`, { method: 'DELETE' });
      reload();
    },
  };
}

export function useBillTime(projectId: string) {
  const a = useAdminAction();
  return {
    ...a,
    bill: (entryIds: string[]) =>
      a.run(async () => {
        const res = await api(`/projects/${projectId}/bill`, { method: 'POST', body: { entryIds } });
        window.location.assign(`/admin/invoices/${String(res.data?.['invoiceId'])}`);
      }),
  };
}
