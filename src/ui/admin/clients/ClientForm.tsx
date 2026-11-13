/**
 * Create / edit a client (R6.2): details, billing (address), the main contact (create only) and internal notes as form
 * sections over the sticky save bar. Field labels are the e2e contract (Organisation name, Email, Tags, City, Contact name…).
 */
import { useState, type FormEvent } from 'react';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { FormSection, SaveBar } from '../form';
import { clientBody, useClientSave, type ClientFormValues } from './useClients';

export function ClientForm({ initial, currencies }: { initial: ClientFormValues; currencies: string[] }) {
  const a = useClientSave(initial.id);
  const editing = !!initial.id;
  const [type, setType] = useState(initial.type);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void a.save(clientBody(new FormData(e.currentTarget), type, editing));
  }
  const b = initial.billingAddress ?? {};
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="c-details" title="Details" description="How the client appears on quotations and invoices.">
        <SelectField label="Type" value={type} onChange={(ev) => setType(ev.target.value as ClientFormValues['type'])}>
          <option value="business">Business or organisation</option>
          <option value="individual">Individual</option>
        </SelectField>
        <TextField
          label={type === 'business' ? 'Organisation name' : 'Full name'}
          name="displayName"
          defaultValue={initial.displayName}
          maxLength={200}
          error={a.err('displayName')}
        />
        {type === 'business' ? (
          <TextField
            label="Registered name"
            hint="Optional"
            name="legalName"
            defaultValue={initial.legalName ?? ''}
            maxLength={200}
            error={a.err('legalName')}
          />
        ) : null}
        <TextField
          label="Email"
          hint="Optional"
          name="email"
          type="email"
          defaultValue={initial.email ?? ''}
          maxLength={254}
          error={a.err('email')}
        />
        <TextField
          label="Phone"
          hint="Optional"
          name="phone"
          type="tel"
          defaultValue={initial.phone ?? ''}
          maxLength={40}
          error={a.err('phone')}
        />
        <TextField
          label="Website"
          hint="Optional"
          name="website"
          type="url"
          defaultValue={initial.website ?? ''}
          maxLength={300}
          error={a.err('website')}
        />
        <TextField
          label="Tax / VAT number"
          hint="Optional"
          name="taxNumber"
          defaultValue={initial.taxNumber ?? ''}
          maxLength={60}
          error={a.err('taxNumber')}
        />
        <TextField
          label="Tags"
          hint="Comma separated, e.g. retail, priority"
          name="tags"
          defaultValue={initial.tags.join(', ')}
          maxLength={330}
          error={a.err('tags')}
        />
      </FormSection>
      <FormSection
        id="c-billing"
        title="Billing"
        description="Defaults for new documents, and the address printed on them."
      >
        <SelectField
          label="Default currency"
          name="defaultCurrency"
          defaultValue={initial.defaultCurrency}
          error={a.err('defaultCurrency')}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Payment terms (days)"
          name="paymentTermsDays"
          type="number"
          min={0}
          max={365}
          inputMode="numeric"
          defaultValue={initial.paymentTermsDays}
          error={a.err('paymentTermsDays')}
        />
        <TextField
          label="Address line 1"
          name="billing.line1"
          defaultValue={b.line1 ?? ''}
          maxLength={160}
          autoComplete="off"
          error={a.err('billingAddress')}
        />
        <TextField
          label="Address line 2"
          name="billing.line2"
          defaultValue={b.line2 ?? ''}
          maxLength={160}
          autoComplete="off"
        />
        <TextField label="City" name="billing.city" defaultValue={b.city ?? ''} maxLength={80} autoComplete="off" />
        <TextField
          label="Province / region"
          name="billing.region"
          defaultValue={b.region ?? ''}
          maxLength={80}
          autoComplete="off"
        />
        <TextField
          label="Postal code"
          name="billing.postalCode"
          defaultValue={b.postalCode ?? ''}
          maxLength={20}
          autoComplete="off"
        />
        <TextField
          label="Country"
          name="billing.country"
          defaultValue={b.country ?? ''}
          maxLength={80}
          autoComplete="off"
        />
      </FormSection>
      {editing ? null : (
        <FormSection id="c-contact" title="Main contact" description="Optional. You can add more contacts later.">
          <TextField
            label="Contact name"
            name="contact.name"
            maxLength={120}
            autoComplete="off"
            error={a.err('primaryContact')}
          />
          <TextField label="Contact email" name="contact.email" type="email" maxLength={254} autoComplete="off" />
          <TextField label="Contact phone" name="contact.phone" type="tel" maxLength={40} autoComplete="off" />
          <TextField label="Job title" name="contact.jobTitle" maxLength={120} autoComplete="off" />
        </FormSection>
      )}
      <FormSection id="c-notes" title="Internal notes" description="Only staff see these." cols={1}>
        <TextareaField
          label="Notes"
          name="notes"
          rows={4}
          defaultValue={initial.notes ?? ''}
          maxLength={5000}
          error={a.err('notes')}
        />
      </FormSection>
      <SaveBar error={a.error}>
        <a href={editing ? `/admin/clients/${initial.id}` : '/admin/clients'} className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {editing ? 'Save changes' : 'Create client'}
        </Button>
      </SaveBar>
    </form>
  );
}
