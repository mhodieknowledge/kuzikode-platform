/**
 * Detail-page actions for one staff member (R6.2 group 3): name, roles, access (resend invitation, reset two-factor, enable /
 * disable). Button names ("Save roles", "Resend invitation", "Disable account"…) are the e2e contract.
 */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { TextField } from '../../primitives';
import { ConfirmSheet } from '../../primitives/sheet';
import { PaneBox } from '../PaneBox';
import { RoleChecklist } from './RoleChecklist';
import { rolesChanged } from './labels';
import { useStaffRecord, type RoleOption } from './useUsers';

export function StaffActions({
  userId,
  name,
  status,
  roles,
  allRoles,
  mfaEnabled,
  isSelf,
}: {
  userId: string;
  name: string;
  status: 'invited' | 'active' | 'disabled';
  roles: string[];
  allRoles: RoleOption[];
  mfaEnabled: boolean;
  isSelf: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(roles);
  const [confirm, setConfirm] = useState<'disable' | 'mfa' | null>(null);
  const a = useStaffRecord(userId);
  const changed = rolesChanged(selected, roles);
  return (
    <div className="kz-astack">
      <FormAlert message={a.error} />
      {a.saved ? (
        <p role="status" className="kz-anotice kz-anotice--ok">
          {a.saved}
        </p>
      ) : null}
      <PaneBox id="name-title" title="Name">
        <form
          className="kz-alog"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void a.saveName(String(new FormData(e.currentTarget).get('name') ?? ''));
          }}
        >
          <TextField label="Full name" name="name" defaultValue={name} maxLength={120} error={a.err('name')} />
          <div className="kz-alog__go">
            <Button type="submit" variant="secondary" loading={a.busy}>
              Save name
            </Button>
          </div>
        </form>
      </PaneBox>
      <PaneBox id="roles-title" title="Roles">
        <div className="kz-alog">
          <p className="kz-hint">Changing roles signs this person out so the new permissions apply straight away.</p>
          <RoleChecklist roles={allRoles} value={selected} onChange={setSelected} error={a.err('roles')} hideLegend />
          <div className="kz-alog__go">
            <Button disabled={!changed} loading={a.busy} onClick={() => void a.saveRoles(selected)}>
              Save roles
            </Button>
          </div>
        </div>
      </PaneBox>
      <PaneBox id="access-title" title="Access">
        <div className="kz-aacts-row">
          {status === 'invited' ? (
            <Button variant="secondary" lead="send" loading={a.busy} onClick={() => void a.resendInvitation()}>
              Resend invitation
            </Button>
          ) : null}
          {mfaEnabled && !isSelf ? (
            <Button variant="secondary" lead="key" onClick={() => setConfirm('mfa')}>
              Reset two-factor authentication
            </Button>
          ) : null}
          {status === 'disabled' ? (
            <Button loading={a.busy} onClick={() => void a.enable()}>
              Enable account
            </Button>
          ) : !isSelf ? (
            <Button variant="danger" onClick={() => setConfirm('disable')}>
              Disable account
            </Button>
          ) : null}
        </div>
      </PaneBox>
      <ConfirmSheet
        open={confirm === 'disable'}
        onClose={() => setConfirm(null)}
        title={`Disable ${name}?`}
        confirmLabel="Disable account"
        danger
        onConfirm={a.disable}
      >
        They are signed out everywhere and cannot sign in until the account is enabled again. Their history is kept.
      </ConfirmSheet>
      <ConfirmSheet
        open={confirm === 'mfa'}
        onClose={() => setConfirm(null)}
        title="Reset two-factor authentication?"
        confirmLabel="Reset two-factor"
        danger
        onConfirm={a.resetMfa}
      >
        Their authenticator and backup codes stop working and their sessions end. They set it up again at their next
        sign-in.
      </ConfirmSheet>
    </div>
  );
}
