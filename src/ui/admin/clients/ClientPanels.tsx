/**
 * Client record islands (R6.2): contacts (add / edit in a sheet, remove with confirmation), the note composer, portal access
 * (invite, approve, revoke) and the archive / restore / delete actions. Button names ("Edit Farai Dube", "Invite to the
 * portal", "Archive"…) and sheet titles are the e2e contract.
 */
import { useState, type FormEvent } from 'react';
import { Button, SelectField, StatusPill, TextareaField, TextField } from '../../primitives';
import { ConfirmSheet, Sheet } from '../../primitives/sheet';
import { FormAlert } from '../../auth/FormAlert';
import { CheckItem } from '../form';
import {
  accessStatusLabel,
  PORTAL_ROLE_OPTIONS,
  useClientRecord,
  type AccessItem,
  type ContactItem,
  type PortalRole,
} from './useClients';

function ContactSheet({
  clientId,
  contact,
  onClose,
}: {
  clientId: string;
  contact?: ContactItem;
  onClose: () => void;
}) {
  const a = useClientRecord(clientId);
  const [primary, setPrimary] = useState(contact?.isPrimary ?? false);
  const [billing, setBilling] = useState(contact?.isBilling ?? false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void a.saveContact(contact?.id ?? null, {
      name: f.get('name'),
      email: f.get('email'),
      phone: f.get('phone'),
      jobTitle: f.get('jobTitle'),
      isPrimary: primary,
      isBilling: billing,
    });
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={contact ? `Edit ${contact.name}` : 'Add contact'}
      className="kz-adlg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="contact-form" loading={a.busy}>
            {contact ? 'Save contact' : 'Add contact'}
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit} noValidate className="kz-astack">
        <FormAlert message={a.error} />
        <TextField label="Name" name="name" defaultValue={contact?.name ?? ''} maxLength={120} error={a.err('name')} />
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={contact?.email ?? ''}
          maxLength={254}
          error={a.err('email')}
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          defaultValue={contact?.phone ?? ''}
          maxLength={40}
          error={a.err('phone')}
        />
        <TextField
          label="Job title"
          name="jobTitle"
          defaultValue={contact?.jobTitle ?? ''}
          maxLength={120}
          error={a.err('jobTitle')}
        />
        <div>
          <CheckItem checked={primary} onChange={(e) => setPrimary(e.target.checked)}>
            Main contact
          </CheckItem>
          <CheckItem checked={billing} onChange={(e) => setBilling(e.target.checked)}>
            Receives invoices
          </CheckItem>
        </div>
      </form>
    </Sheet>
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
  const a = useClientRecord(clientId);
  return (
    <section className="kz-apane" aria-labelledby="contacts-title">
      <div className="kz-apane__head">
        <h2 id="contacts-title" className="kz-apane__title">
          Contacts
        </h2>
        <span className="kz-apane__meta">{contacts.length}</span>
        {canEdit ? (
          <div className="kz-apane__acts">
            <Button size="sm" lead="add" onClick={() => setEditing('new')}>
              Add contact
            </Button>
          </div>
        ) : null}
      </div>
      <div className="kz-apane__body is-flush">
        {a.error ? (
          <div className="kz-apad">
            <FormAlert message={a.error} />
          </div>
        ) : null}
        {contacts.length === 0 ? (
          <p className="kz-anone">
            <span className="kz-anone__code">0 contacts</span>No contacts yet.
          </p>
        ) : (
          <ul className="kz-alist">
            {contacts.map((c) => (
              <li key={c.id}>
                <div className="kz-alist__main">
                  <p className="kz-alist__t">
                    {c.name}{' '}
                    {c.isPrimary ? (
                      <StatusPill tone="lit" plain className="kz-pill--xs">
                        Main
                      </StatusPill>
                    ) : null}{' '}
                    {c.isBilling ? (
                      <StatusPill plain className="kz-pill--xs">
                        Billing
                      </StatusPill>
                    ) : null}
                  </p>
                  <p className="kz-alist__m">
                    {[c.jobTitle, c.email, c.phone].filter(Boolean).join(' · ') || 'No details'}
                  </p>
                </div>
                {canEdit ? (
                  <div className="kz-arow-acts">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                      Edit<span className="sr-only"> {c.name}</span>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRemoving(c)}>
                      Remove<span className="sr-only"> {c.name}</span>
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing ? (
        <ContactSheet
          clientId={clientId}
          {...(editing === 'new' ? {} : { contact: editing })}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? 'contact'}?`}
        confirmLabel="Remove contact"
        danger
        onConfirm={() => a.removeContact(removing!.id)}
      >
        Contacts that appear on quotations or invoices are kept.
      </ConfirmSheet>
    </section>
  );
}

export function NoteForm({ clientId }: { clientId: string }) {
  const a = useClientRecord(clientId);
  return (
    <form
      noValidate
      className="kz-alog"
      onSubmit={(e) => {
        e.preventDefault();
        void a.addNote(String(new FormData(e.currentTarget).get('body') ?? ''));
      }}
    >
      <TextareaField
        label="Add a note"
        hint="Only staff can see notes."
        name="body"
        rows={3}
        maxLength={5000}
        error={a.err('body')}
      />
      {a.err('body') ? null : <FormAlert message={a.error} />}
      <div className="kz-alog__go">
        <Button type="submit" variant="secondary" lead="add" loading={a.busy}>
          Add note
        </Button>
      </div>
    </form>
  );
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
  const [role, setRole] = useState<PortalRole>('member');
  const [revoking, setRevoking] = useState<AccessItem | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const a = useClientRecord(clientId);
  const invitable = contacts.filter((c) => c.email);
  const roleLabel = (r: PortalRole) => (r === 'owner' ? 'Owner' : r === 'billing' ? 'Billing' : 'Member');
  return (
    <section className="kz-apane" aria-labelledby="portal-title">
      <div className="kz-apane__head">
        <h2 id="portal-title" className="kz-apane__title">
          Portal access
        </h2>
        <span className="kz-apane__meta">{access.length}</span>
        {canEdit ? (
          <div className="kz-apane__acts">
            <Button size="sm" lead="send" onClick={() => setInviting(true)} disabled={invitable.length === 0}>
              Invite to the portal
            </Button>
          </div>
        ) : null}
      </div>
      <div className="kz-apane__body is-flush">
        {a.error || sent || (canEdit && invitable.length === 0) ? (
          <div className="kz-apad kz-astack">
            <FormAlert message={a.error} />
            {sent ? (
              <p role="status" className="kz-anotice kz-anotice--ok">
                {sent}
              </p>
            ) : null}
            {canEdit && invitable.length === 0 ? (
              <p className="kz-adlg__desc">Add a contact with an email address first.</p>
            ) : null}
          </div>
        ) : null}
        {access.length === 0 ? (
          <p className="kz-anone">
            <span className="kz-anone__code">0 people</span>Nobody from this client can use the portal yet.
          </p>
        ) : (
          <ul className="kz-alist">
            {access.map((x) => (
              <li key={x.id}>
                <div className="kz-alist__main">
                  <p className="kz-alist__t">{x.name}</p>
                  <p className="kz-alist__m">
                    {x.email} · {roleLabel(x.role)} · {accessStatusLabel(x)}
                  </p>
                </div>
                {canEdit ? (
                  <div className="kz-arow-acts">
                    {x.status === 'pending' && x.userStatus === 'active' ? (
                      <Button size="sm" loading={a.busy} onClick={() => void a.access(x.id, 'approve')}>
                        Approve<span className="sr-only"> {x.name}</span>
                      </Button>
                    ) : null}
                    {x.status !== 'revoked' ? (
                      <Button size="sm" variant="secondary" onClick={() => setRevoking(x)}>
                        Revoke<span className="sr-only"> {x.name}</span>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Sheet
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite to the client portal"
        className="kz-adlg"
        describedBy="invite-desc"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" loading={a.busy} disabled={!contactId}>
              Send invitation
            </Button>
          </>
        }
      >
        <p id="invite-desc" className="kz-adlg__desc">
          They get an email with a link to set a password. Access starts when they accept.
        </p>
        <form
          id="invite-form"
          noValidate
          className="kz-astack"
          onSubmit={(e) => {
            e.preventDefault();
            void a.invite(contactId, role, () => {
              setInviting(false);
              setSent('Invitation sent.');
            });
          }}
        >
          <FormAlert message={a.error} />
          <SelectField
            label="Contact"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            error={a.err('contactId')}
          >
            <option value="" disabled>
              Choose a contact
            </option>
            {invitable.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.name} (${c.email})`}
              </option>
            ))}
          </SelectField>
          <SelectField label="Access" value={role} onChange={(e) => setRole(e.target.value as PortalRole)}>
            {PORTAL_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        </form>
      </Sheet>
      <ConfirmSheet
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={`Revoke portal access for ${revoking?.name ?? 'this person'}?`}
        confirmLabel="Revoke access"
        danger
        onConfirm={() => a.access(revoking!.id, 'revoke')}
      >
        They can no longer see this client&apos;s documents in the portal. Their account remains for any other clients.
      </ConfirmSheet>
    </section>
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
  const a = useClientRecord(clientId);
  return (
    <div className="kz-aacts">
      <div className="kz-ahead__acts">
        {status === 'active' ? (
          <Button variant="secondary" onClick={() => setConfirm('archive')}>
            Archive
          </Button>
        ) : (
          <Button variant="secondary" loading={a.busy} onClick={() => void a.restore()}>
            Restore
          </Button>
        )}
        {canDelete ? (
          <Button variant="secondary" lead="delete" onClick={() => setConfirm('delete')}>
            Delete
          </Button>
        ) : null}
      </div>
      <FormAlert message={a.error} />
      <ConfirmSheet
        open={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        title="Archive this client?"
        confirmLabel="Archive client"
        onConfirm={() => a.archive()}
      >
        Archived clients are hidden from lists and can&apos;t be used on new documents. Their history is kept and you
        can restore them.
      </ConfirmSheet>
      <ConfirmSheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete this client?"
        confirmLabel="Delete client"
        danger
        onConfirm={() => a.remove()}
      >
        Only possible because this client has no documents, projects or portal access. This can&apos;t be undone.
      </ConfirmSheet>
    </div>
  );
}
