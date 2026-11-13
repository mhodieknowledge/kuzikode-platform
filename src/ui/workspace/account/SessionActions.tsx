/** Device actions on "Signed-in devices" (R5.4): sign out one other device, or every device after a confirmation sheet. */
import { useState } from 'react';
import { Button, ConfirmSheet } from '../../primitives';
import { useSessions } from './useAccount';

export function SignOutDevice({ sessionId, device }: { sessionId: string; device: string }) {
  const s = useSessions();
  return (
    <Button variant="secondary" size="sm" loading={s.busy === sessionId} onClick={() => s.revoke(sessionId)}>
      Sign out<span className="sr-only"> {device}</span>
    </Button>
  );
}

export function SignOutEverywhere() {
  const s = useSessions();
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
        <p>This signs out every session, including this one. You will need to sign in again.</p>
      </ConfirmSheet>
    </>
  );
}
