/**
 * "Request cancellation" under a subscription window (R5.4, used by /portal/services): the trigger opens an inline form with an
 * optional reason; sending opens a billing support request and moves to it. Labels are the e2e contract.
 */
import { useState } from 'react';
import { Button, TextareaField } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { useCancellation } from './useSupport';

export function CancellationRequest({ subscriptionId, description }: { subscriptionId: string; description: string }) {
  const s = useCancellation(subscriptionId);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Request cancellation of ${description}`}
      >
        Request cancellation
      </Button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void s.submit(String(new FormData(e.currentTarget).get('reason') ?? ''));
      }}
      noValidate
      className="kz-scancel"
      aria-label={`Cancel ${description}`}
    >
      <FormAlert message={s.error} />
      <p className="kz-scancel__note">
        We will open a support request and our team will confirm the cancellation and any final bill with you.
      </p>
      <TextareaField label="Reason (optional)" name="reason" rows={3} maxLength={2000} error={s.field('reason')} />
      <div className="kz-scancel__bar">
        <Button type="submit" size="sm" variant="danger" loading={s.busy}>
          Send cancellation request
        </Button>
        <Button type="button" size="sm" variant="quiet" onClick={() => setOpen(false)}>
          Keep my service
        </Button>
      </div>
    </form>
  );
}
