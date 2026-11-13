/**
 * Create / update / delete for the small list managers (products, announcements, FAQ, technologies, categories,
 * testimonials, add-ons): one busy / error state, the call, then a page reload so the server-rendered list is current.
 */
import { reload, useAdminAction } from '../action';
import type { adminApi } from './lib';

export function useCrud(api: ReturnType<typeof adminApi>, path: string) {
  const a = useAdminAction();
  const save = (id: string | null | undefined, body: unknown) =>
    a.run(async () => {
      await api(id ? `${path}/${id}` : path, { method: id ? 'PUT' : 'POST', body });
      reload();
    });
  const remove = (id: string) =>
    a.run(async () => {
      await api(`${path}/${id}`, { method: 'DELETE' });
      reload();
    });
  return { ...a, save, remove };
}
