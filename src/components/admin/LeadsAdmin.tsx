/** Enquiry inbox and lead pipeline islands (P4.5). The server validates and authorises every action. */
import { useState, type FormEvent } from 'react';
import {
  ApiError,
  apiFetch,
  Button,
  ConfirmDialog,
  DateInput,
  Dialog,
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from '../ui';

const reload = () => window.location.reload();

function useAction() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { errors, error, busy, run };
}

function Alert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
      {message}
    </p>
  ) : null;
}

export interface StaffOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------- enquiries

/** Actions on one enquiry: create a lead from it, mark spam, close, or reopen. */
export function EnquiryActions({
  enquiryId,
  status,
  leadId,
  canTriage,
  staff,
  meId,
}: {
  enquiryId: string;
  status: 'new' | 'triaged' | 'spam' | 'closed';
  leadId: string | null;
  canTriage: boolean;
  staff: StaffOption[];
  meId: string;
}) {
  const a = useAction();
  const [triaging, setTriaging] = useState(false);
  const [assignee, setAssignee] = useState(staff.some((s) => s.id === meId) ? meId : '');
  const setStatus = (next: 'new' | 'spam' | 'closed') =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/enquiries/${enquiryId}/status`, { body: { status: next } });
      reload();
    });
  return (
    <div className="flex flex-col gap-3">
      <Alert message={a.error} />
      <div className="flex flex-wrap gap-2">
        {leadId ? (
          <a
            href={`/admin/leads/${leadId}`}
            className="inline-flex h-10 items-center rounded-sm bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Open lead
          </a>
        ) : canTriage && status !== 'spam' ? (
          <Button onClick={() => setTriaging(true)}>Create lead</Button>
        ) : null}
        {status === 'new' || status === 'triaged' ? (
          <>
            <Button variant="secondary" loading={a.busy} onClick={() => setStatus('closed')}>
              Close
            </Button>
            {!leadId ? (
              <Button variant="ghost" loading={a.busy} onClick={() => setStatus('spam')}>
                Mark as spam
              </Button>
            ) : null}
          </>
        ) : (
          <Button variant="secondary" loading={a.busy} onClick={() => setStatus('new')}>
            {status === 'spam' ? 'Not spam' : 'Reopen'}
          </Button>
        )}
      </div>
      <Dialog
        open={triaging}
        onOpenChange={setTriaging}
        title="Create a lead from this enquiry"
        description="The lead copies the contact details, the requested service and the budget."
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              const res = await apiFetch<{ data: { leadId: string } }>(`/api/v1/admin/enquiries/${enquiryId}/lead`, {
                body: { assignedTo: assignee || null },
              });
              window.location.assign(`/admin/leads/${res.data.leadId}`);
            });
          }}
        >
          <Alert message={a.error} />
          <Field label="Assign to" error={a.errors['assignedTo']}>
            <Select
              value={assignee}
              onChange={(ev) => setAssignee(ev.target.value)}
              options={[{ value: '', label: 'Nobody yet' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setTriaging(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Create lead
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- leads

export interface LeadFormValues {
  id?: string;
  title: string;
  source: 'website' | 'referral' | 'manual' | 'social' | 'other';
  status: 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';
  contactName: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  assignedTo: string | null;
  estimatedValueMinor: number | null;
  currency: string | null;
  nextFollowUpOn: string | null;
  lostReason: string | null;
  notes: string | null;
  serviceIds: string[];
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];
const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Added by staff' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social media' },
  { value: 'other', label: 'Other' },
];

/** Create or edit a lead. */
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
  const a = useAction();
  const editing = !!initial.id;
  const [status, setStatus] = useState(initial.status);
  const [currency, setCurrency] = useState(initial.currency ?? currencies[0] ?? 'USD');
  const [value, setValue] = useState<number | null>(initial.estimatedValueMinor);
  const [valueError, setValueError] = useState<string | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (valueError) return;
    const f = new FormData(e.currentTarget);
    const body = {
      title: f.get('title'),
      source: f.get('source'),
      status,
      contactName: f.get('contactName'),
      email: f.get('email'),
      phone: f.get('phone'),
      organisation: f.get('organisation'),
      assignedTo: f.get('assignedTo') || null,
      estimatedValueMinor: value,
      currency: value != null ? currency : null,
      nextFollowUpOn: f.get('nextFollowUpOn') || null,
      lostReason: status === 'lost' ? f.get('lostReason') : undefined,
      notes: f.get('notes'),
      serviceIds,
    };
    await a.run(async () => {
      if (editing) {
        await apiFetch(`/api/v1/admin/leads/${initial.id}`, { method: 'PUT', body });
        window.location.assign(`/admin/leads/${initial.id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/leads', { body });
        window.location.assign(`/admin/leads/${res.data.id}`);
      }
    });
  }
  const e = a.errors;
  const divisions = [...new Set(services.map((s) => s.division))];
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="l-details">
        <h2 id="l-details" className="font-sans text-base font-semibold">
          Lead
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={e['title']} className="sm:col-span-2">
            <Input name="title" defaultValue={initial.title} maxLength={160} placeholder="e.g. Acme: new website" />
          </Field>
          <Field label="Stage" required error={e['status']}>
            <Select
              value={status}
              onChange={(ev) => setStatus(ev.target.value as LeadFormValues['status'])}
              options={STATUS_OPTIONS}
            />
          </Field>
          <Field label="Source" required error={e['source']}>
            <Select name="source" defaultValue={initial.source} options={SOURCE_OPTIONS} />
          </Field>
          {status === 'lost' ? (
            <Field label="Why was it lost?" required error={e['lostReason']} className="sm:col-span-2">
              <Input name="lostReason" defaultValue={initial.lostReason ?? ''} maxLength={300} />
            </Field>
          ) : null}
          <Field label="Assigned to" error={e['assignedTo']}>
            <Select
              name="assignedTo"
              defaultValue={initial.assignedTo ?? ''}
              options={[{ value: '', label: 'Nobody yet' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <Field label="Next follow-up" hint="Optional" error={e['nextFollowUpOn']}>
            <DateInput name="nextFollowUpOn" defaultValue={initial.nextFollowUpOn ?? ''} />
          </Field>
          <Field label="Currency" error={e['currency']}>
            <Select
              value={currency}
              onChange={(ev) => setCurrency(ev.target.value)}
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Estimated value" hint="Optional" error={valueError ?? e['estimatedValueMinor']}>
            <MoneyInput valueMinor={value} onChangeMinor={setValue} currency={currency} onParseError={setValueError} />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="l-contact">
        <h2 id="l-contact" className="font-sans text-base font-semibold">
          Contact
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" error={e['contactName']}>
            <Input name="contactName" defaultValue={initial.contactName ?? ''} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Organisation" hint="Optional" error={e['organisation']}>
            <Input name="organisation" defaultValue={initial.organisation ?? ''} maxLength={160} autoComplete="off" />
          </Field>
          <Field label="Email" error={e['email']}>
            <Input name="email" type="email" defaultValue={initial.email ?? ''} maxLength={254} autoComplete="off" />
          </Field>
          <Field label="Phone" error={e['phone']}>
            <Input name="phone" type="tel" defaultValue={initial.phone ?? ''} maxLength={40} autoComplete="off" />
          </Field>
        </div>
      </section>
      {services.length ? (
        <fieldset className="rounded-lg border border-line bg-surface p-6">
          <legend className="px-1 font-sans text-base font-semibold">Services of interest</legend>
          {e['serviceIds'] ? (
            <p role="alert" className="mt-1 text-sm text-danger-700">
              {e['serviceIds'][0]}
            </p>
          ) : null}
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {divisions.map((d) => (
              <div key={d}>
                <p className="text-[13px] font-semibold text-ink-600">{d}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {services
                    .filter((s) => s.division === d)
                    .map((s) => (
                      <li key={s.id}>
                        <label className="flex items-center gap-2 text-sm text-ink-950">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-600"
                            checked={serviceIds.includes(s.id)}
                            onChange={(ev) =>
                              setServiceIds((ids) =>
                                ev.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id),
                              )
                            }
                          />
                          {s.name}
                        </label>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="l-notes">
        <h2 id="l-notes" className="font-sans text-base font-semibold">
          Notes
        </h2>
        <Field label="Notes" hideLabel hint="Only staff see these." error={e['notes']} className="mt-3">
          <Textarea name="notes" rows={4} defaultValue={initial.notes ?? ''} maxLength={5000} />
        </Field>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {editing ? 'Save changes' : 'Create lead'}
        </Button>
        <a
          href={editing ? `/admin/leads/${initial.id}` : '/admin/leads'}
          className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

const ACTIVITY_OPTIONS = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'follow_up', label: 'Follow-up reminder' },
];

/** Log a note, call, email or meeting, or schedule a follow-up. */
export function ActivityForm({ leadId }: { leadId: string }) {
  const a = useAction();
  const [type, setType] = useState('note');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const dueOn = String(f.get('dueOn') ?? '');
    await a.run(async () => {
      await apiFetch(`/api/v1/admin/leads/${leadId}/activities`, {
        body: { type, body: f.get('body'), ...(type === 'follow_up' && dueOn ? { dueOn } : {}) },
      });
      reload();
    });
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Log activity">
      <Alert message={a.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select value={type} onChange={(ev) => setType(ev.target.value)} options={ACTIVITY_OPTIONS} />
        </Field>
        {type === 'follow_up' ? (
          <Field label="Follow up on" required error={a.errors['dueOn']}>
            <DateInput name="dueOn" />
          </Field>
        ) : null}
      </div>
      <Field label={type === 'follow_up' ? 'What to do' : 'Details'} required error={a.errors['body']}>
        <Textarea name="body" rows={3} maxLength={5000} />
      </Field>
      <div>
        <Button type="submit" loading={a.busy}>
          {type === 'follow_up' ? 'Schedule follow-up' : 'Add to log'}
        </Button>
      </div>
    </form>
  );
}

export function CompleteFollowUp({ leadId, activityId }: { leadId: string; activityId: string }) {
  const a = useAction();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={a.busy}
        onClick={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/leads/${leadId}/activities/${activityId}/complete`, { body: {} });
            reload();
          })
        }
      >
        Mark done
      </Button>
      {a.error ? (
        <span role="alert" className="text-[12px] text-danger-700">
          {a.error}
        </span>
      ) : null}
    </span>
  );
}

/** Converts the lead into a client record and opens it. */
export function ConvertLead({ leadId, name }: { leadId: string; name: string }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Convert to client</Button>
      {a.error ? (
        <p role="alert" className="text-sm text-danger-700">
          {a.error}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Convert ${name} to a client?`}
        description="This creates a client record with the lead's contact details and marks the lead as won."
        confirmLabel="Convert to client"
        onConfirm={() =>
          a.run(async () => {
            const res = await apiFetch<{ data: { clientId: string } }>(`/api/v1/admin/leads/${leadId}/convert`, {
              body: {},
            });
            window.location.assign(`/admin/clients/${res.data.clientId}`);
          })
        }
      />
    </>
  );
}
