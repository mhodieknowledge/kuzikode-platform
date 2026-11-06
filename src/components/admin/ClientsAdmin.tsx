/** Client administration islands (P4.4). The server validates and authorises every action. */
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, Checkbox, ConfirmDialog, Dialog, Field, Input, Select, Textarea } from '../ui';

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

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface ClientFormValues {
  id?: string;
  type: 'individual' | 'business';
  displayName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxNumber: string | null;
  billingAddress: Address | null;
  defaultCurrency: string;
  paymentTermsDays: number;
  notes: string | null;
  tags: string[];
}

const addr = (f: FormData, prefix: string): Address => ({
  line1: String(f.get(`${prefix}.line1`) ?? ''),
  line2: String(f.get(`${prefix}.line2`) ?? ''),
  city: String(f.get(`${prefix}.city`) ?? ''),
  region: String(f.get(`${prefix}.region`) ?? ''),
  postalCode: String(f.get(`${prefix}.postalCode`) ?? ''),
  country: String(f.get(`${prefix}.country`) ?? ''),
});

/** Create or edit a client. On create, a primary contact can be added in the same step. */
export function ClientForm({ initial, currencies }: { initial: ClientFormValues; currencies: string[] }) {
  const a = useAction();
  const editing = !!initial.id;
  const [type, setType] = useState(initial.type);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      type,
      displayName: f.get('displayName'),
      legalName: f.get('legalName'),
      email: f.get('email'),
      phone: f.get('phone'),
      website: f.get('website'),
      taxNumber: f.get('taxNumber'),
      billingAddress: addr(f, 'billing'),
      defaultCurrency: f.get('defaultCurrency'),
      paymentTermsDays: Number(f.get('paymentTermsDays')),
      notes: f.get('notes'),
      tags: String(f.get('tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const contactName = String(f.get('contact.name') ?? '').trim();
    if (!editing && contactName) {
      body['primaryContact'] = {
        name: contactName,
        email: f.get('contact.email'),
        phone: f.get('contact.phone'),
        jobTitle: f.get('contact.jobTitle'),
        isPrimary: true,
        isBilling: true,
      };
    }
    await a.run(async () => {
      if (editing) {
        await apiFetch(`/api/v1/admin/clients/${initial.id}`, { method: 'PUT', body });
        window.location.assign(`/admin/clients/${initial.id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/clients', { body });
        window.location.assign(`/admin/clients/${res.data.id}`);
      }
    });
  }
  const e = a.errors;
  const b = initial.billingAddress ?? {};
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="c-details">
        <h2 id="c-details" className="font-sans text-base font-semibold">
          Details
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <Select
              value={type}
              onChange={(ev) => setType(ev.target.value as 'individual' | 'business')}
              options={[
                { value: 'business', label: 'Business or organisation' },
                { value: 'individual', label: 'Individual' },
              ]}
            />
          </Field>
          <Field label={type === 'business' ? 'Organisation name' : 'Full name'} required error={e['displayName']}>
            <Input name="displayName" defaultValue={initial.displayName} maxLength={200} />
          </Field>
          {type === 'business' ? (
            <Field label="Registered name" hint="Optional" error={e['legalName']}>
              <Input name="legalName" defaultValue={initial.legalName ?? ''} maxLength={200} />
            </Field>
          ) : null}
          <Field label="Email" hint="Optional" error={e['email']}>
            <Input name="email" type="email" defaultValue={initial.email ?? ''} maxLength={254} />
          </Field>
          <Field label="Phone" hint="Optional" error={e['phone']}>
            <Input name="phone" type="tel" defaultValue={initial.phone ?? ''} maxLength={40} />
          </Field>
          <Field label="Website" hint="Optional" error={e['website']}>
            <Input name="website" type="url" defaultValue={initial.website ?? ''} maxLength={300} />
          </Field>
          <Field label="Tax / VAT number" hint="Optional" error={e['taxNumber']}>
            <Input name="taxNumber" defaultValue={initial.taxNumber ?? ''} maxLength={60} />
          </Field>
          <Field label="Tags" hint="Comma separated, e.g. retail, priority" error={e['tags']}>
            <Input name="tags" defaultValue={initial.tags.join(', ')} maxLength={330} />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="c-billing">
        <h2 id="c-billing" className="font-sans text-base font-semibold">
          Billing
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Default currency" required error={e['defaultCurrency']}>
            <Select
              name="defaultCurrency"
              defaultValue={initial.defaultCurrency}
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Payment terms (days)" required error={e['paymentTermsDays']}>
            <Input
              name="paymentTermsDays"
              type="number"
              min={0}
              max={365}
              defaultValue={initial.paymentTermsDays}
              inputMode="numeric"
            />
          </Field>
          <Field label="Address line 1" error={e['billingAddress']}>
            <Input name="billing.line1" defaultValue={b.line1 ?? ''} maxLength={160} autoComplete="off" />
          </Field>
          <Field label="Address line 2">
            <Input name="billing.line2" defaultValue={b.line2 ?? ''} maxLength={160} autoComplete="off" />
          </Field>
          <Field label="City">
            <Input name="billing.city" defaultValue={b.city ?? ''} maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Province / region">
            <Input name="billing.region" defaultValue={b.region ?? ''} maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Postal code">
            <Input name="billing.postalCode" defaultValue={b.postalCode ?? ''} maxLength={20} autoComplete="off" />
          </Field>
          <Field label="Country">
            <Input name="billing.country" defaultValue={b.country ?? ''} maxLength={80} autoComplete="off" />
          </Field>
        </div>
      </section>
      {editing ? null : (
        <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="c-contact">
          <h2 id="c-contact" className="font-sans text-base font-semibold">
            Main contact
          </h2>
          <p className="mt-1 text-sm text-ink-600">Optional. You can add more contacts later.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" error={e['primaryContact']}>
              <Input name="contact.name" maxLength={120} autoComplete="off" />
            </Field>
            <Field label="Contact email">
              <Input name="contact.email" type="email" maxLength={254} autoComplete="off" />
            </Field>
            <Field label="Contact phone">
              <Input name="contact.phone" type="tel" maxLength={40} autoComplete="off" />
            </Field>
            <Field label="Job title">
              <Input name="contact.jobTitle" maxLength={120} autoComplete="off" />
            </Field>
          </div>
        </section>
      )}
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="c-notes">
        <h2 id="c-notes" className="font-sans text-base font-semibold">
          Internal notes
        </h2>
        <Field label="Notes" hideLabel hint="Only staff see these." error={e['notes']} className="mt-3">
          <Textarea name="notes" rows={4} defaultValue={initial.notes ?? ''} maxLength={5000} />
        </Field>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {editing ? 'Save changes' : 'Create client'}
        </Button>
        <a
          href={editing ? `/admin/clients/${initial.id}` : '/admin/clients'}
          className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

export interface ContactItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  isBilling: boolean;
}

function ContactDialog({
  clientId,
  contact,
  open,
  onOpenChange,
}: {
  clientId: string;
  contact?: ContactItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const a = useAction();
  const [primary, setPrimary] = useState(contact?.isPrimary ?? false);
  const [billing, setBilling] = useState(contact?.isBilling ?? false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get('name'),
      email: f.get('email'),
      phone: f.get('phone'),
      jobTitle: f.get('jobTitle'),
      isPrimary: primary,
      isBilling: billing,
    };
    await a.run(async () => {
      if (contact) await apiFetch(`/api/v1/admin/clients/${clientId}/contacts/${contact.id}`, { method: 'PUT', body });
      else await apiFetch(`/api/v1/admin/clients/${clientId}/contacts`, { body });
      reload();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={contact ? `Edit ${contact.name}` : 'Add contact'}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Alert message={a.error} />
        <Field label="Name" required error={a.errors['name']}>
          <Input name="name" defaultValue={contact?.name ?? ''} maxLength={120} />
        </Field>
        <Field label="Email" error={a.errors['email']}>
          <Input name="email" type="email" defaultValue={contact?.email ?? ''} maxLength={254} />
        </Field>
        <Field label="Phone" error={a.errors['phone']}>
          <Input name="phone" type="tel" defaultValue={contact?.phone ?? ''} maxLength={40} />
        </Field>
        <Field label="Job title" error={a.errors['jobTitle']}>
          <Input name="jobTitle" defaultValue={contact?.jobTitle ?? ''} maxLength={120} />
        </Field>
        <Checkbox label="Main contact" checked={primary} onCheckedChange={setPrimary} />
        <Checkbox label="Receives invoices" checked={billing} onCheckedChange={setBilling} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={a.busy}>
            {contact ? 'Save contact' : 'Add contact'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ContactsPanel({
  clientId,
  contacts,
  canEdit,
}: {
  clientId: string;
  contacts: ContactItem[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ContactItem | 'new' | null>(null);
  const [removing, setRemoving] = useState<ContactItem | null>(null);
  const a = useAction();
  return (
    <div className="flex flex-col gap-4">
      <Alert message={a.error} />
      {canEdit ? (
        <div>
          <Button onClick={() => setEditing('new')}>Add contact</Button>
        </div>
      ) : null}
      {contacts.length === 0 ? (
        <p className="text-sm text-ink-600">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold text-ink-950">
                  {c.name}
                  {c.isPrimary ? (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-600">
                      Main
                    </span>
                  ) : null}
                  {c.isBilling ? (
                    <span className="ml-2 rounded-full bg-ink-950/5 px-2 py-0.5 text-[12px] font-semibold text-ink-800">
                      Billing
                    </span>
                  ) : null}
                </p>
                <p className="text-[13px] text-ink-600">
                  {[c.jobTitle, c.email, c.phone].filter(Boolean).join(' · ') || 'No details'}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                    Edit<span className="sr-only"> {c.name}</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(c)}>
                    Remove<span className="sr-only"> {c.name}</span>
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <ContactDialog
          clientId={clientId}
          {...(editing === 'new' ? {} : { contact: editing })}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? 'contact'}?`}
        description="Contacts that appear on quotations or invoices are kept."
        confirmLabel="Remove contact"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/clients/${clientId}/contacts/${removing!.id}`, { method: 'DELETE' });
            reload();
          })
        }
      />
    </div>
  );
}

export function NoteForm({ clientId }: { clientId: string }) {
  const a = useAction();
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const body = String(new FormData(e.currentTarget).get('body') ?? '');
        void a.run(async () => {
          await apiFetch(`/api/v1/admin/clients/${clientId}/notes`, { body: { body } });
          reload();
        });
      }}
    >
      <Field label="Add a note" hint="Only staff can see notes." error={a.errors['body']}>
        <Textarea name="body" rows={3} maxLength={5000} />
      </Field>
      <div>
        <Button type="submit" variant="secondary" loading={a.busy}>
          Add note
        </Button>
      </div>
      <Alert message={a.errors['body'] ? null : a.error} />
    </form>
  );
}

export interface AccessItem {
  id: string;
  role: 'owner' | 'member' | 'billing';
  status: 'pending' | 'active' | 'revoked';
  name: string;
  email: string;
  userStatus: string;
}

export function PortalAccessPanel({
  clientId,
  access,
  contacts,
  canEdit,
}: {
  clientId: string;
  access: AccessItem[];
  contacts: { id: string; name: string; email: string | null }[];
  canEdit: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const [contactId, setContactId] = useState('');
  const [role, setRole] = useState<'owner' | 'member' | 'billing'>('member');
  const [revoking, setRevoking] = useState<AccessItem | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const a = useAction();
  const invitable = contacts.filter((c) => c.email);
  const statusLabel = (x: AccessItem) =>
    x.status === 'pending'
      ? x.userStatus === 'invited'
        ? 'Invitation sent'
        : 'Waiting for approval'
      : x.status === 'active'
        ? 'Active'
        : 'Revoked';
  return (
    <div className="flex flex-col gap-4">
      <Alert message={a.error} />
      {sent ? (
        <p role="status" className="rounded-sm bg-success-50 px-4 py-3 text-sm text-success-700">
          {sent}
        </p>
      ) : null}
      {canEdit ? (
        <div>
          <Button onClick={() => setInviting(true)} disabled={invitable.length === 0}>
            Invite to the portal
          </Button>
          {invitable.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-600">Add a contact with an email address first.</p>
          ) : null}
        </div>
      ) : null}
      {access.length === 0 ? (
        <p className="text-sm text-ink-600">Nobody from this client can use the portal yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {access.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold text-ink-950">{x.name}</p>
                <p className="text-[13px] text-ink-600">
                  {x.email} · {x.role === 'owner' ? 'Owner' : x.role === 'billing' ? 'Billing' : 'Member'} ·{' '}
                  {statusLabel(x)}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  {x.status === 'pending' && x.userStatus === 'active' ? (
                    <Button
                      size="sm"
                      loading={a.busy}
                      onClick={() =>
                        void a.run(async () => {
                          await apiFetch(`/api/v1/admin/clients/${clientId}/portal/access/${x.id}`, {
                            body: { action: 'approve' },
                          });
                          reload();
                        })
                      }
                    >
                      Approve<span className="sr-only"> {x.name}</span>
                    </Button>
                  ) : null}
                  {x.status !== 'revoked' ? (
                    <Button size="sm" variant="ghost" onClick={() => setRevoking(x)}>
                      Revoke<span className="sr-only"> {x.name}</span>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={inviting}
        onOpenChange={setInviting}
        title="Invite to the client portal"
        description="They get an email with a link to set a password. Access starts when they accept."
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await apiFetch(`/api/v1/admin/clients/${clientId}/portal/invitations`, { body: { contactId, role } });
              setInviting(false);
              setSent('Invitation sent.');
              window.setTimeout(reload, 800);
            });
          }}
        >
          <Field label="Contact" required error={a.errors['contactId']}>
            <Select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="Choose a contact"
              options={invitable.map((c) => ({ value: c.id, label: `${c.name} (${c.email})` }))}
            />
          </Field>
          <Field label="Access" required>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              options={[
                { value: 'member', label: 'Member: projects, documents and support' },
                { value: 'billing', label: 'Billing: invoices and payments' },
                { value: 'owner', label: 'Owner: everything' },
              ]}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy} disabled={!contactId}>
              Send invitation
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke portal access for ${revoking?.name ?? 'this person'}?`}
        description="They can no longer see this client's documents in the portal. Their account remains for any other clients."
        confirmLabel="Revoke access"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/clients/${clientId}/portal/access/${revoking!.id}`, {
              body: { action: 'revoke' },
            });
            reload();
          })
        }
      />
    </div>
  );
}

export function ClientStatusActions({
  clientId,
  status,
  canDelete,
}: {
  clientId: string;
  status: 'active' | 'archived';
  canDelete: boolean;
}) {
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const a = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Alert message={a.error} />
      {status === 'active' ? (
        <Button variant="secondary" onClick={() => setConfirm('archive')}>
          Archive
        </Button>
      ) : (
        <Button
          variant="secondary"
          loading={a.busy}
          onClick={() =>
            void a.run(async () => {
              await apiFetch(`/api/v1/admin/clients/${clientId}/restore`, { method: 'POST', body: {} });
              reload();
            })
          }
        >
          Restore
        </Button>
      )}
      {canDelete ? (
        <Button variant="ghost" onClick={() => setConfirm('delete')}>
          Delete
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => setConfirm(o ? 'archive' : null)}
        title="Archive this client?"
        description="Archived clients are hidden from lists and can't be used on new documents. Their history is kept and you can restore them."
        confirmLabel="Archive client"
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/clients/${clientId}/archive`, { method: 'POST', body: {} });
            reload();
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => setConfirm(o ? 'delete' : null)}
        title="Delete this client?"
        description="Only possible because this client has no documents, projects or portal access. This can't be undone."
        confirmLabel="Delete client"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/clients/${clientId}`, { method: 'DELETE' });
            window.location.assign('/admin/clients');
          })
        }
      />
    </div>
  );
}
