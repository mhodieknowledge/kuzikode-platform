/** "Invite staff member": a sheet with name, email and roles (R6.2 group 3). Dialog title, labels and button names are the e2e contract. */
import { useState } from 'react';
import { Button } from '../../primitives/button';
import { TextField } from '../../primitives';
import { FormSheet } from '../form';
import { RoleChecklist } from './RoleChecklist';
import { useInvite, type RoleOption } from './useUsers';

export function InviteStaffButton({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const a = useInvite();
  return (
    <>
      <Button lead="add" onClick={() => setOpen(true)}>
        Invite staff member
      </Button>
      {open ? (
        <FormSheet
          open
          onClose={() => setOpen(false)}
          title="Invite a staff member"
          formId="invite-staff"
          submitLabel="Send invitation"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) => void a.invite(f, selected)}
        >
          <p className="kz-adlg__desc">
            They will get an email with a link to set their password. The link works once and expires in 7 days.
          </p>
          <TextField label="Full name" name="name" maxLength={120} autoComplete="off" error={a.err('name')} />
          <TextField
            label="Work email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="off"
            error={a.err('email')}
          />
          <RoleChecklist roles={roles} value={selected} onChange={setSelected} error={a.err('roles')} />
        </FormSheet>
      ) : null}
    </>
  );
}
