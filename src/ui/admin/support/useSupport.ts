/**
 * Logic of the admin support islands (R6.2 group 3), carried over unchanged from the pre-redesign
 * `components/admin/SupportAdmin.tsx`: open a request for a client, reply or add an internal note, change status / priority /
 * assignee.
 */
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export function useNewRequest() {
  const a = useAdminAction();
  const open = (body: Record<string, unknown>) =>
    a.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/support', { body });
      window.location.assign(`/admin/support/${res.data.id}`);
    });
  return { ...a, open };
}

export function useReply(requestId: string) {
  const a = useAdminAction();
  const send = (f: FormData, internal: boolean, status: string) => {
    f.set('internal', String(internal));
    if (status) f.set('status', status);
    else f.delete('status');
    return a.run(async () => {
      await apiFetch(`/api/v1/admin/support/${requestId}/messages`, { method: 'POST', body: f });
      reload();
    });
  };
  return { ...a, send };
}

export function useRequestControls(requestId: string) {
  const a = useAdminAction();
  const save = (patch: Record<string, unknown>) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/support/${requestId}`, { method: 'PATCH', body: patch });
      reload();
    });
  return { ...a, save };
}
