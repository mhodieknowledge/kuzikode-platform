/**
 * Expense logic (R6.2), carried over unchanged from the pre-R6.2 ExpensesAdmin island: save with an optional receipt upload,
 * void, and category management.
 */
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  active: number;
  used: number;
}

export function useExpenseSave(id: string | undefined) {
  const a = useAdminAction();
  const save = (body: Record<string, unknown>, receipt: FormDataEntryValue | null) =>
    a.run(async () => {
      let target = id;
      if (id) await apiFetch(`/api/v1/admin/expenses/${id}`, { method: 'PUT', body });
      else target = (await apiFetch<{ data: { id: string } }>('/api/v1/admin/expenses', { body })).data.id;
      if (receipt instanceof File && receipt.size > 0) {
        const form = new FormData();
        form.set('file', receipt);
        await apiFetch(`/api/v1/admin/expenses/${target}/receipt`, { method: 'POST', body: form });
      }
      window.location.assign(`/admin/expenses/${target}`);
    });
  return { ...a, save };
}

export function useVoidExpense(id: string) {
  const a = useAdminAction();
  const voidIt = (reason: FormDataEntryValue | null) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/expenses/${id}/void`, { body: { reason } });
      reload();
    });
  return { ...a, voidIt };
}

export function useCategories() {
  const a = useAdminAction();
  const save = (current: ExpenseCategory | null, body: Record<string, unknown>) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/expenses/categories${current ? `/${current.id}` : ''}`, {
        method: current ? 'PUT' : 'POST',
        body,
      });
      reload();
    });
  const remove = (c: ExpenseCategory) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/expenses/categories/${c.id}`, { method: 'DELETE' });
      reload();
    });
  return { ...a, save, remove };
}
