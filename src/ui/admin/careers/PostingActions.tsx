/** Open / close / archive / reopen / duplicate a posting (R6.2). Which buttons show depends on the status; each asks first. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import {
  postingActionHelp,
  postingActionLabel,
  postingOptions,
  usePostingActions,
  type PostingStatus,
} from './useCareers';

export function PostingActions({ id, status }: { id: string; status: PostingStatus }) {
  const a = usePostingActions(id);
  const [confirm, setConfirm] = useState<PostingStatus | null>(null);
  const label = postingActionLabel(status);
  return (
    <>
      {postingOptions(status).map((o) => (
        <Button key={o} variant={o === 'open' ? 'primary' : 'secondary'} onClick={() => setConfirm(o)}>
          {label[o]}
        </Button>
      ))}
      <Button variant="secondary" loading={a.busy} onClick={() => void a.post('duplicate', {})}>
        Duplicate
      </Button>
      {a.error ? <FormAlert message={a.error} /> : null}
      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? `${label[confirm]}?` : ''}
        confirmLabel={confirm ? label[confirm] : ''}
        onConfirm={() => a.post('status', { status: confirm })}
      >
        {confirm ? postingActionHelp[confirm] : null}
      </ConfirmSheet>
    </>
  );
}
