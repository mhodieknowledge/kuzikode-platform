/** Pause, resume or cancel a subscription (R6.2); which buttons show is decided on the server page from status + permission. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { TextareaField, TextField } from '../../primitives';
import { Button, LinkButton } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import { FormSheet } from '../form';
import { useSubscriptionActions } from './useSubscriptions';

export function SubscriptionActions({
  id,
  status,
}: {
  id: string;
  status: 'active' | 'at_risk' | 'paused' | 'cancelled' | 'ended';
}) {
  const a = useSubscriptionActions(id);
  const [confirm, setConfirm] = useState<'pause' | 'resume' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const billing = status === 'active' || status === 'at_risk';
  const pausing = confirm === 'pause';
  return (
    <div className="kz-aacts">
      <div className="kz-ahead__acts">
        <LinkButton variant="secondary" lead="edit" href={`/admin/subscriptions/${id}/edit`}>
          Edit
        </LinkButton>
        {billing ? (
          <Button variant="secondary" onClick={() => setConfirm('pause')}>
            Pause billing
          </Button>
        ) : null}
        {status === 'paused' ? (
          <Button variant="secondary" onClick={() => setConfirm('resume')}>
            Resume billing
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => setCancelOpen(true)}>
          Cancel subscription
        </Button>
      </div>
      {cancelOpen ? null : <FormAlert message={a.error} />}
      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={pausing ? 'Pause billing?' : 'Resume billing?'}
        confirmLabel={pausing ? 'Pause' : 'Resume'}
        onConfirm={() => (pausing ? a.pause() : a.resume())}
      >
        {pausing
          ? 'No invoices are created while paused. Nothing changes for the client’s services.'
          : 'Billing continues from the next scheduled date on or after today. Missed periods are not invoiced.'}
      </ConfirmSheet>
      <FormSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this subscription?"
        formId="sub-cancel"
        submitLabel="Cancel subscription"
        cancelLabel="Keep it"
        danger
        busy={a.busy}
        error={a.error}
        onSubmit={(f) => void a.cancel(String(f.get('reason') ?? ''), String(f.get('effectiveDate') ?? ''))}
      >
        <p className="kz-adlg__desc">No further invoices are created. Invoices already issued stay as they are.</p>
        <TextareaField label="Reason" name="reason" rows={2} maxLength={500} error={a.err('reason')} />
        <TextField
          label="Effective date"
          hint="Defaults to today"
          type="date"
          name="effectiveDate"
          error={a.err('effectiveDate')}
        />
      </FormSheet>
    </div>
  );
}
