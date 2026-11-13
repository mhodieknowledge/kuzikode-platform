/**
 * Invoice draft editor (R6.2): details, the line-item editor (one billing period, no recurring lines), terms and notes over
 * the sticky save bar. Request body and labels are unchanged (e2e contract: Line n …, Overall discount, Create draft).
 */
import { useState, type FormEvent } from 'react';
import type { DiscountType } from '../../../shared/pricing';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { FormSection, SaveBar } from '../form';
import { LineItemEditor } from '../documents/LineItemEditor';
import {
  docDiscountFrom,
  newLine,
  toApiDiscount,
  toApiLines,
  type CatalogueOption,
  type EditorLine,
  type TaxOption,
} from '../documents/lines';
import { useInvoiceSave } from './useInvoices';

export interface InvoiceEditorProps {
  id?: string;
  initial: {
    clientId: string;
    contactId: string | null;
    currency: string;
    issueDate: string | null;
    dueDate: string | null;
    paymentTermsDays: number | null;
    notes: string | null;
    terms: string | null;
    discountType: DiscountType;
    discountValue: number;
    lines: EditorLine[];
  };
  clients: { id: string; name: string; number: string; currency: string }[];
  contacts: { id: string; client_id: string; name: string; email: string | null }[];
  currencies: { code: string; minor_digits: number }[];
  taxRates: TaxOption[];
  catalogue: CatalogueOption[];
}

export function InvoiceEditor({ id, initial, clients, contacts, currencies, taxRates, catalogue }: InvoiceEditorProps) {
  const a = useInvoiceSave(id);
  const [clientId, setClientId] = useState(initial.clientId);
  const [contactId, setContactId] = useState(initial.contactId ?? '');
  const [currency, setCurrency] = useState(initial.currency);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines.length ? initial.lines : [newLine()]);
  const [docDiscount, setDocDiscount] = useState(docDiscountFrom(initial.discountType, initial.discountValue));
  const minorDigits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  const clientContacts = contacts.filter((c) => c.client_id === clientId);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const terms = String(f.get('paymentTermsDays') ?? '').trim();
    void a.save({
      clientId,
      contactId: contactId || null,
      currency,
      issueDate: f.get('issueDate') || null,
      dueDate: f.get('dueDate') || null,
      paymentTermsDays: terms === '' ? null : Number(terms),
      notes: f.get('notes'),
      terms: f.get('terms'),
      ...toApiDiscount(docDiscount),
      items: toApiLines(lines),
    });
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="i-details" title="Details" description="Who it is for, when it is due and in which currency.">
        <SelectField
          label="Client"
          value={clientId}
          onChange={(ev) => {
            setClientId(ev.target.value);
            setContactId('');
            const c = clients.find((x) => x.id === ev.target.value);
            if (c && !lines.some((l) => l.unitPriceMinor)) setCurrency(c.currency);
          }}
          error={a.err('clientId')}
        >
          <option value="">Choose a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {`${c.name} (${c.number})`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Send to"
          hint="Defaults to the client's main contact."
          value={contactId}
          onChange={(ev) => setContactId(ev.target.value)}
          error={a.err('contactId')}
        >
          <option value="">Main contact</option>
          {clientContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {`${c.name}${c.email ? ` (${c.email})` : ''}`}
            </option>
          ))}
        </SelectField>
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
          label="Payment terms (days)"
          hint="Leave empty for the client's default."
          name="paymentTermsDays"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          defaultValue={initial.paymentTermsDays ?? ''}
          error={a.err('paymentTermsDays')}
        />
        <TextField
          label="Issue date"
          hint="Leave empty to use the day it is issued."
          type="date"
          name="issueDate"
          defaultValue={initial.issueDate ?? ''}
          error={a.err('issueDate')}
        />
        <TextField
          label="Due date"
          hint="Leave empty to use issue date + payment terms."
          type="date"
          name="dueDate"
          defaultValue={initial.dueDate ?? ''}
          error={a.err('dueDate')}
        />
      </FormSection>
      <FormSection
        id="i-lines"
        title="Lines"
        description={`Prices in ${currency}. Totals are a preview; the server recalculates on save.`}
        wide
        cols={1}
      >
        <LineItemEditor
          lines={lines}
          onChange={setLines}
          currency={currency}
          minorDigits={minorDigits}
          taxRates={taxRates}
          catalogue={catalogue}
          docDiscount={docDiscount}
          onDocDiscount={setDocDiscount}
          errors={a.errors}
          allowRecurring={false}
        />
      </FormSection>
      <FormSection id="i-terms" title="Terms and notes" description="Printed under the lines." cols={1}>
        <TextareaField
          label="Notes to the client"
          name="notes"
          rows={3}
          defaultValue={initial.notes ?? ''}
          maxLength={5000}
          error={a.err('notes')}
        />
        <TextareaField
          label="Terms"
          name="terms"
          rows={4}
          defaultValue={initial.terms ?? ''}
          maxLength={5000}
          error={a.err('terms')}
        />
      </FormSection>
      <SaveBar error={a.error} hint="Drafts are not sent. Issuing gives the invoice its number.">
        <a href={id ? `/admin/invoices/${id}` : '/admin/invoices'} className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {id ? 'Save draft' : 'Create draft'}
        </Button>
      </SaveBar>
    </form>
  );
}
