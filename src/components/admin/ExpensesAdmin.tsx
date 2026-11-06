/** Expense islands (P4.13): record/edit form with receipt upload, void, and category management. */
import { useState, type FormEvent } from 'react';
import { EXPENSE_PAYMENT_METHODS } from '../../shared/schemas/expenses';
import { apiFetch, Button, Checkbox, DateInput, Dialog, Field, Input, MoneyInput, Select, Textarea } from '../ui';
import { Alert, useAction } from './actions';

export interface ExpenseFormProps {
  id?: string;
  initial: {
    categoryId: string;
    expenseDate: string;
    vendor: string | null;
    description: string;
    amountMinor: number | null;
    currency: string;
    paymentMethod: string | null;
    reference: string | null;
    projectId: string | null;
    clientId: string | null;
    notes: string | null;
  };
  categories: { id: string; name: string }[];
  currencies: { code: string; minor_digits: number }[];
  projects: { id: string; label: string }[];
  clients: { id: string; name: string }[];
  hasReceipt: boolean;
}

export function ExpenseForm({ id, initial, categories, currencies, projects, clients, hasReceipt }: ExpenseFormProps) {
  const a = useAction();
  const [amount, setAmount] = useState<number | null>(initial.amountMinor);
  const [currency, setCurrency] = useState(initial.currency);
  const digits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      categoryId: f.get('categoryId'),
      expenseDate: f.get('expenseDate'),
      vendor: f.get('vendor'),
      description: f.get('description'),
      amountMinor: amount ?? 0,
      currency,
      paymentMethod: f.get('paymentMethod') || null,
      reference: f.get('reference'),
      projectId: f.get('projectId') || null,
      clientId: f.get('clientId') || null,
      notes: f.get('notes'),
    };
    const receipt = f.get('receipt');
    await a.run(async () => {
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
  }
  const e = a.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="grid gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2">
        <Field label="Date" required error={e['expenseDate']}>
          <DateInput name="expenseDate" defaultValue={initial.expenseDate} />
        </Field>
        <Field label="Category" required error={e['categoryId']}>
          <Select
            name="categoryId"
            defaultValue={initial.categoryId}
            placeholder="Choose a category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Description" required error={e['description']} className="sm:col-span-2">
          <Input name="description" defaultValue={initial.description} maxLength={500} />
        </Field>
        <Field label={`Amount (${currency})`} required error={e['amountMinor']}>
          <MoneyInput valueMinor={amount} onChangeMinor={setAmount} currency={currency} minorDigits={digits} />
        </Field>
        <Field label="Currency" required error={e['currency']}>
          <Select
            value={currency}
            onChange={(ev) => setCurrency(ev.target.value)}
            options={currencies.map((c) => ({ value: c.code, label: c.code }))}
          />
        </Field>
        <Field label="Vendor" error={e['vendor']}>
          <Input name="vendor" defaultValue={initial.vendor ?? ''} maxLength={200} />
        </Field>
        <Field label="Payment method" error={e['paymentMethod']}>
          <Select
            name="paymentMethod"
            defaultValue={initial.paymentMethod ?? ''}
            options={[{ value: '', label: 'Not recorded' }, ...EXPENSE_PAYMENT_METHODS]}
          />
        </Field>
        <Field label="Reference" hint="Invoice or receipt number from the vendor." error={e['reference']}>
          <Input name="reference" defaultValue={initial.reference ?? ''} maxLength={120} />
        </Field>
        <Field label="Project" hint="Optional." error={e['projectId']}>
          <Select
            name="projectId"
            defaultValue={initial.projectId ?? ''}
            options={[{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.id, label: p.label }))]}
          />
        </Field>
        <Field label="Client" hint="Optional. Set automatically from the project." error={e['clientId']}>
          <Select
            name="clientId"
            defaultValue={initial.clientId ?? ''}
            options={[{ value: '', label: 'None' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </Field>
        <Field
          label={hasReceipt ? 'Replace receipt' : 'Receipt'}
          hint="Photo or PDF, up to 10 MB."
          error={e['file']}
          className="sm:col-span-2"
        >
          <Input name="receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" />
        </Field>
        <Field label="Notes" error={e['notes']} className="sm:col-span-2">
          <Textarea name="notes" rows={2} defaultValue={initial.notes ?? ''} maxLength={2000} />
        </Field>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {id ? 'Save expense' : 'Record expense'}
        </Button>
        <a
          href={id ? `/admin/expenses/${id}` : '/admin/expenses'}
          className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

export function VoidExpense({ id }: { id: string }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Void
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Void this expense?">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await apiFetch(`/api/v1/admin/expenses/${id}/void`, { body: { reason: f.get('reason') } });
              window.location.reload();
            });
          }}
        >
          <p className="text-sm text-ink-800">Void expenses stay on record but are left out of totals and reports.</p>
          <Field label="Reason" required error={a.errors['reason']}>
            <Textarea name="reason" rows={2} maxLength={500} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={a.busy}>
              Void expense
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  active: number;
  used: number;
}

export function CategoriesManager({ categories, canManage }: { categories: Category[]; canManage: boolean }) {
  const a = useAction();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [active, setActive] = useState(true);
  const open = (c: Category | 'new') => {
    setActive(c === 'new' ? true : c.active === 1);
    setEditing(c);
  };
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div>
          <Button onClick={() => open('new')}>New category</Button>
        </div>
      ) : null}
      <Alert message={editing ? null : a.error} />
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-ink-950">
                {c.name}
                {c.active ? '' : ' (inactive)'}
              </p>
              <p className="text-[12px] text-ink-600">
                {c.description ? `${c.description} · ` : ''}
                {c.used} {c.used === 1 ? 'expense' : 'expenses'}
              </p>
            </div>
            {canManage ? (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => open(c)}>
                  Edit
                </Button>
                {c.used === 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${c.name}`}
                    onClick={() =>
                      a.run(async () => {
                        await apiFetch(`/api/v1/admin/expenses/categories/${c.id}`, { method: 'DELETE' });
                        window.location.reload();
                      })
                    }
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? `Edit ${current.name}` : 'New category'}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              const body = { name: f.get('name'), description: f.get('description'), active };
              await apiFetch(`/api/v1/admin/expenses/categories${current ? `/${current.id}` : ''}`, {
                method: current ? 'PUT' : 'POST',
                body,
              });
              window.location.reload();
            });
          }}
        >
          <Field label="Name" required error={a.errors['name']}>
            <Input name="name" defaultValue={current?.name ?? ''} maxLength={80} />
          </Field>
          <Field label="Description" error={a.errors['description']}>
            <Input name="description" defaultValue={current?.description ?? ''} maxLength={300} />
          </Field>
          <Checkbox label="Active (can be chosen for new expenses)" checked={active} onCheckedChange={setActive} />
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
