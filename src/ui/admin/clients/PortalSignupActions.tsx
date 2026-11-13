/** One self-registered portal account waiting for staff (R6.2): link it to a client, or decline it. Labels are the e2e contract. */
import { useState } from 'react';
import { Button, SelectField } from '../../primitives';
import { ConfirmSheet, Sheet } from '../../primitives/sheet';
import { FormAlert } from '../../auth/FormAlert';
import { PORTAL_ROLE_OPTIONS, usePortalSignup, type PortalRole } from './useClients';

export function PortalSignupActions({
  userId,
  name,
  clients,
}: {
  userId: string;
  name: string;
  clients: { id: string; name: string }[];
}) {
  const [linking, setLinking] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [clientId, setClientId] = useState('');
  const [role, setRole] = useState<PortalRole>('member');
  const a = usePortalSignup(userId);
  const formId = `link-${userId}`;
  return (
    <div className="kz-aacts">
      <div className="kz-arow-acts">
        <Button size="sm" onClick={() => setLinking(true)} disabled={clients.length === 0}>
          Link to a client<span className="sr-only"> for {name}</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setDeclining(true)}>
          Decline<span className="sr-only"> {name}</span>
        </Button>
      </div>
      {!linking ? <FormAlert message={a.error} /> : null}
      <Sheet
        open={linking}
        onClose={() => setLinking(false)}
        title={`Link ${name} to a client`}
        className="kz-adlg"
        describedBy={`${formId}-desc`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinking(false)}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={a.busy} disabled={!clientId}>
              Link account
            </Button>
          </>
        }
      >
        <p id={`${formId}-desc`} className="kz-adlg__desc">
          Only link people you have confirmed belong to that client. They will see its quotations, invoices and
          projects.
        </p>
        <form
          id={formId}
          noValidate
          className="kz-astack"
          onSubmit={(e) => {
            e.preventDefault();
            void a.link(clientId, role);
          }}
        >
          <FormAlert message={a.error} />
          <SelectField
            label="Client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            error={a.err('clientId')}
          >
            <option value="" disabled>
              Choose a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
        open={declining}
        onClose={() => setDeclining(false)}
        title={`Decline ${name}'s sign-up?`}
        confirmLabel="Decline sign-up"
        danger
        onConfirm={() => a.decline()}
      >
        Their portal account is switched off and they are signed out. Nothing is shared with them.
      </ConfirmSheet>
    </div>
  );
}
