/**
 * Create / edit a lead (R6.2): four form sections (lead, contact, services of interest, notes) and the sticky save bar.
 * Field labels are the e2e contract (Title, Stage, Why was it lost?, Estimated value, Contact name).
 */
import { useState, type FormEvent } from 'react';
import { Field, MoneyInput, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { CheckItem, FormSection, SaveBar } from '../form';
import {
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  leadBody,
  useLeadSave,
  type LeadFormValues,
  type LeadStatus,
  type StaffOption,
} from './useLeads';

export function LeadForm({
  initial,
  staff,
  services,
  currencies,
}: {
  initial: LeadFormValues;
  staff: StaffOption[];
  services: { id: string; name: string; division: string }[];
  currencies: string[];
}) {
  const a = useLeadSave(initial.id);
  const editing = !!initial.id;
  const [status, setStatus] = useState<LeadStatus>(initial.status);
  const [currency, setCurrency] = useState(initial.currency ?? currencies[0] ?? 'USD');
  const [value, setValue] = useState<number | null>(initial.estimatedValueMinor);
  const [valueError, setValueError] = useState<string | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (valueError) return;
    void a.save(leadBody(new FormData(e.currentTarget), { status, value, currency, serviceIds }));
  }
  const divisions = [...new Set(services.map((s) => s.division))];
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection
        id="l-details"
        title="Lead"
        description="What the opportunity is, where it came from and who owns it."
      >
        <TextField
          label="Title"
          name="title"
          defaultValue={initial.title}
          maxLength={160}
          placeholder="e.g. Acme: new website"
          error={a.err('title')}
          className="kz-span-2"
        />
        <SelectField
          label="Stage"
          value={status}
          onChange={(ev) => setStatus(ev.target.value as LeadStatus)}
          error={a.err('status')}
        >
          {LEAD_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Source" name="source" defaultValue={initial.source} error={a.err('source')}>
          {LEAD_SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        {status === 'lost' ? (
          <TextField
            label="Why was it lost?"
            name="lostReason"
            defaultValue={initial.lostReason ?? ''}
            maxLength={300}
            error={a.err('lostReason')}
            className="kz-span-2"
          />
        ) : null}
        <SelectField
          label="Assigned to"
          name="assignedTo"
          defaultValue={initial.assignedTo ?? ''}
          error={a.err('assignedTo')}
        >
          <option value="">Nobody yet</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Next follow-up"
          optional
          type="date"
          name="nextFollowUpOn"
          defaultValue={initial.nextFollowUpOn ?? ''}
          error={a.err('nextFollowUpOn')}
        />
        <SelectField
          label="Currency"
          value={currency}
          onChange={(ev) => setCurrency(ev.target.value)}
          error={a.err('currency')}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <Field label="Estimated value" optional error={valueError ?? a.err('estimatedValueMinor')}>
          {(p) => (
            <MoneyInput
              {...p}
              valueMinor={value}
              onChangeMinor={setValue}
              currency={currency}
              onParseError={setValueError}
            />
          )}
        </Field>
      </FormSection>
      <FormSection
        id="l-contact"
        title="Contact"
        description="Who to talk to. Copied to the client record on conversion."
      >
        <TextField
          label="Contact name"
          name="contactName"
          defaultValue={initial.contactName ?? ''}
          maxLength={120}
          autoComplete="off"
          error={a.err('contactName')}
        />
        <TextField
          label="Organisation"
          optional
          name="organisation"
          defaultValue={initial.organisation ?? ''}
          maxLength={160}
          autoComplete="off"
          error={a.err('organisation')}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={initial.email ?? ''}
          maxLength={254}
          autoComplete="off"
          error={a.err('email')}
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          defaultValue={initial.phone ?? ''}
          maxLength={40}
          autoComplete="off"
          error={a.err('phone')}
        />
      </FormSection>
      {services.length ? (
        <FormSection id="l-services" title="Services of interest" cols={1}>
          {a.err('serviceIds') ? (
            <p role="alert" className="kz-error">
              {a.err('serviceIds')}
            </p>
          ) : null}
          <div className="kz-acheckgrid">
            {divisions.map((d) => (
              <div key={d}>
                <p className="kz-acheckgrid__g">{d}</p>
                <ul>
                  {services
                    .filter((s) => s.division === d)
                    .map((s) => (
                      <li key={s.id}>
                        <CheckItem
                          checked={serviceIds.includes(s.id)}
                          onChange={(ev) =>
                            setServiceIds((ids) => (ev.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)))
                          }
                        >
                          {s.name}
                        </CheckItem>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </FormSection>
      ) : null}
      <FormSection id="l-notes" title="Notes" description="Only staff see these." cols={1}>
        <TextareaField
          label="Notes"
          name="notes"
          rows={4}
          defaultValue={initial.notes ?? ''}
          maxLength={5000}
          error={a.err('notes')}
        />
      </FormSection>
      <SaveBar error={a.error} hint={editing ? 'Stage changes are recorded in the activity log.' : undefined}>
        <a href={editing ? `/admin/leads/${initial.id}` : '/admin/leads'} className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {editing ? 'Save changes' : 'Create lead'}
        </Button>
      </SaveBar>
    </form>
  );
}
