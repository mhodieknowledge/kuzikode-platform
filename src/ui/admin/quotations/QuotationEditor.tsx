/**
 * Quotation draft editor (R6.2): details, the line-item editor (with "Add package"), terms and notes, over the sticky save
 * bar. The request body and labels are unchanged (e2e contract: Title, Line n …, Overall discount, Create draft).
 */
import { useState, type FormEvent } from 'react';
import type { DiscountType } from '../../../shared/pricing';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { RichText } from '../../primitives/RichText';
import { FormSection, SaveBar } from '../form';
import { LineItemEditor } from '../documents/LineItemEditor';
import {
  docDiscountFrom,
  newLine,
  toApiDiscount,
  toApiLines,
  isBlankLine,
  type CatalogueOption,
  type EditorLine,
  type TaxOption,
} from '../documents/lines';
import { AddPackage } from './AddPackage';
import { useQuotationSave } from './useQuotations';

export interface QuotationEditorProps {
  id?: string;
  initial: {
    clientId: string;
    contactId: string | null;
    leadId: string | null;
    enquiryId: string | null;
    title: string;
    introHtml: string;
    currency: string;
    validUntil: string | null;
    paymentTerms: string | null;
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

export function QuotationEditor({
  id,
  initial,
  clients,
  contacts,
  currencies,
  taxRates,
  catalogue,
}: QuotationEditorProps) {
  const a = useQuotationSave(id);
  const [clientId, setClientId] = useState(initial.clientId);
  const [contactId, setContactId] = useState(initial.contactId ?? '');
  const [currency, setCurrency] = useState(initial.currency);
  const [intro, setIntro] = useState(initial.introHtml);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines.length ? initial.lines : [newLine()]);
  const [docDiscount, setDocDiscount] = useState(docDiscountFrom(initial.discountType, initial.discountValue));
  const minorDigits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  const clientContacts = contacts.filter((c) => c.client_id === clientId);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void a.save({
      clientId,
      contactId: contactId || null,
      leadId: initial.leadId,
      enquiryId: initial.enquiryId,
      title: f.get('title'),
      introHtml: intro,
      currency,
      validUntil: f.get('validUntil') || null,
      paymentTerms: f.get('paymentTerms'),
      notes: f.get('notes'),
      terms: f.get('terms'),
      ...toApiDiscount(docDiscount),
      items: toApiLines(lines),
    });
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection
        id="q-details"
        title="Details"
        description="Who it is for, what it is called and how long it stands."
      >
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
        <TextField
          label="Title"
          name="title"
          defaultValue={initial.title}
          maxLength={200}
          placeholder="e.g. New company website"
          error={a.err('title')}
          className="kz-span-2"
        />
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
          label="Valid until"
          type="date"
          name="validUntil"
          hint="Leave empty to use the default validity when sent."
          defaultValue={initial.validUntil ?? ''}
          error={a.err('validUntil')}
        />
        <Field
          label="Introduction"
          hint="Optional. Use it for a proposal-style quotation."
          error={a.err('introHtml')}
          className="kz-span-2"
        >
          {(p) => <RichText {...p} label="Introduction" value={intro} onChange={setIntro} minHeight={120} />}
        </Field>
      </FormSection>
      <FormSection
        id="q-lines"
        title="Lines"
        description={`Prices in ${currency}. Totals are a preview; the server recalculates on save.`}
        wide
        cols={1}
        action={
          <AddPackage
            currency={currency}
            onAdd={(added) => setLines((cur) => [...cur.filter((l) => !isBlankLine(l)), ...added])}
          />
        }
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
        />
      </FormSection>
      <FormSection id="q-terms" title="Terms and notes" description="Printed under the lines." cols={1}>
        <TextField
          label="Payment terms"
          hint="e.g. 50% deposit, balance on completion."
          name="paymentTerms"
          defaultValue={initial.paymentTerms ?? ''}
          maxLength={500}
          error={a.err('paymentTerms')}
        />
        <TextareaField
          label="Notes to the client"
          name="notes"
          rows={3}
          defaultValue={initial.notes ?? ''}
          maxLength={5000}
          error={a.err('notes')}
        />
        <TextareaField
          label="Terms and conditions"
          name="terms"
          rows={4}
          defaultValue={initial.terms ?? ''}
          maxLength={5000}
          error={a.err('terms')}
        />
      </FormSection>
      <SaveBar error={a.error} hint="Drafts are not sent. Sending gives the quotation its number.">
        <a href={id ? `/admin/quotations/${id}` : '/admin/quotations'} className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {id ? 'Save draft' : 'Create draft'}
        </Button>
      </SaveBar>
    </form>
  );
}
