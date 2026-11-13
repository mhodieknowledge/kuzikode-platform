/**
 * Admin account islands (R6.2 group 3): notification read buttons, signed-in device actions and two-factor management.
 * Button names ("Mark all as read", "Mark as read: <title>", "Sign out", "Sign out everywhere", "New backup codes", "Turn off")
 * stay as before.
 */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { TextField } from '../../primitives';
import { ConfirmSheet } from '../../primitives/sheet';
import { useAdminMfa, useAdminSessions, useMarkRead } from './useAdminAccount';

export function MarkAllReadButton() {
  const r = useMarkRead();
  return (
    <Button variant="secondary" lead="check" loading={r.busy === 'all'} onClick={() => r.mark([])}>
      Mark all as read
    </Button>
  );
}

/** Marks one notification as read. */
export function MarkReadButton({ id, title }: { id: string; title: string }) {
  const r = useMarkRead();
  return (
    <Button variant="secondary" size="sm" loading={r.busy === id} onClick={() => r.mark([id])}>
      Mark as read<span className="sr-only">: {title}</span>
    </Button>
  );
}

/** Sign out one other device (name it for assistive tech). */
export function SignOutDevice({ sessionId, device }: { sessionId: string; device: string }) {
  const s = useAdminSessions();
  return (
    <Button variant="secondary" size="sm" loading={s.busy === sessionId} onClick={() => s.revoke(sessionId)}>
      Sign out<span className="sr-only"> {device}</span>
    </Button>
  );
}

/** Every session, including this one, after a confirmation sheet. */
export function SignOutEverywhere() {
  const s = useAdminSessions();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" size="sm" lead="sign-out" onClick={() => setOpen(true)}>
        Sign out everywhere
      </Button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Sign out of every device?"
        confirmLabel="Sign out everywhere"
        danger
        onConfirm={s.signOutEverywhere}
      >
        This signs out every session, including this one. You will need to sign in again.
      </ConfirmSheet>
    </>
  );
}

/** Turn 2FA off (only when the role does not require it) or get new backup codes; both need password + code. */
export function MfaManage({ canDisable }: { canDisable: boolean }) {
  const m = useAdminMfa();
  return (
    <div className="kz-alog">
      {m.codes ? (
        <div role="status" className="kz-anotice kz-anotice--ok" style={{ display: 'block' }}>
          <p>New backup codes. Your old codes no longer work.</p>
          <ul className="kz-acodes" aria-label="Backup codes">
            {m.codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {m.mode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void m.submit(new FormData(e.currentTarget));
          }}
          noValidate
          className="kz-alog"
          aria-label={m.mode === 'disable' ? 'Turn off two-factor authentication' : 'Create new backup codes'}
        >
          <FormAlert message={m.error} />
          <div className="kz-alog__row">
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              error={m.field('password')}
            />
            <TextField
              label="Authentication code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={20}
              error={m.field('code')}
            />
          </div>
          <div className="kz-aacts-row">
            <Button type="submit" variant={m.mode === 'disable' ? 'danger' : 'primary'} loading={m.busy}>
              {m.mode === 'disable' ? 'Turn off two-factor authentication' : 'Create new backup codes'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => m.open(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="kz-aacts-row">
          <Button variant="secondary" lead="refresh" onClick={() => m.open('codes')}>
            New backup codes
          </Button>
          {canDisable ? (
            <Button variant="secondary" onClick={() => m.open('disable')}>
              Turn off
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
