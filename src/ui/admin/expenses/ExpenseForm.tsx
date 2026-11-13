/**
 * Record / edit an expense (R6.2): details and attachments as form sections over the sticky save bar. Labels are the e2e
 * contract (Category, Description, Amount (USD), Vendor, the receipt file input, Record expense).
 */
import { useState, type FormEvent } from 'react';
import { EXPENSE_PAYMENT_METHODS } from '../../../shared/schemas/expenses';
import { Field, MoneyInput, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { FormSection, SaveBar } from '../form';
import { useExpenseSave } from './useExpenses';

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
  const a = useExpenseSave(id);
  const [amount, setAmount] = useState<number | null>(initial.amountMinor);
  const [currency, setCurrency] = useState(initial.currency);
  const digits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void a.save(
      {
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
      },
      f.get('receipt'),
    );
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="e-details" title="Details" description="What was bought, from whom, and what it cost.">
        <TextField
          label="Date"
          type="date"
          name="expenseDate"
          defaultValue={initial.expenseDate}
          error={a.err('expenseDate')}
        />
        <SelectField label="Category" name="categoryId" defaultValue={initial.categoryId} error={a.err('categoryId')}>
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Description"
          name="description"
          defaultValue={initial.description}
          maxLength={500}
          error={a.err('description')}
          className="kz-span-2"
        />
        <Field label={`Amount (${currency})`} error={a.err('amountMinor')}>
          {(p) => (
            <MoneyInput {...p} valueMinor={amount} onChangeMinor={setAmount} currency={currency} minorDigits={digits} />
          )}
        </Field>
        <SelectField
          label="Currency"
          value={currency}
          onChange={(ev) => setCurrency(ev.target.value)}
          error={a.err('currency')}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Vendor"
          name="vendor"
          defaultValue={initial.vendor ?? ''}
          maxLength={200}
          error={a.err('vendor')}
        />
        <SelectField
          label="Payment method"
          name="paymentMethod"
          defaultValue={initial.paymentMethod ?? ''}
          error={a.err('paymentMethod')}
        >
          <option value="">Not recorded</option>
          {EXPENSE_PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Reference"
          hint="Invoice or receipt number from the vendor."
          name="reference"
          defaultValue={initial.reference ?? ''}
          maxLength={120}
          error={a.err('reference')}
        />
      </FormSection>
      <FormSection
        id="e-link"
        title="Link and receipt"
        description="Optional: tie it to a project or client and keep the receipt."
      >
        <SelectField
          label="Project"
          hint="Optional."
          name="projectId"
          defaultValue={initial.projectId ?? ''}
          error={a.err('projectId')}
        >
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Client"
          hint="Optional. Set automatically from the project."
          name="clientId"
          defaultValue={initial.clientId ?? ''}
          error={a.err('clientId')}
        >
          <option value="">None</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <Field
          label={hasReceipt ? 'Replace receipt' : 'Receipt'}
          hint="Photo or PDF, up to 10 MB."
          error={a.err('file')}
          className="kz-span-2"
        >
          {(p) => (
            <input
              {...p}
              name="receipt"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="kz-input kz-afile"
            />
          )}
        </Field>
        <TextareaField
          label="Notes"
          name="notes"
          rows={2}
          defaultValue={initial.notes ?? ''}
          maxLength={2000}
          error={a.err('notes')}
          className="kz-span-2"
        />
      </FormSection>
      <SaveBar error={a.error}>
        <a href={id ? `/admin/expenses/${id}` : '/admin/expenses'} className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {id ? 'Save expense' : 'Record expense'}
        </Button>
      </SaveBar>
    </form>
  );
}
