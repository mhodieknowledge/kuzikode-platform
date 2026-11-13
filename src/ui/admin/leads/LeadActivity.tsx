/**
 * Lead detail islands (R6.2): the activity composer (note, call, email, meeting or a follow-up reminder), "Mark done" on an
 * open follow-up and "Convert to client" with its confirmation. Labels are the e2e contract.
 */
import { useState, type FormEvent } from 'react';
import { Button, SelectField, TextareaField, TextField } from '../../primitives';
import { ConfirmSheet } from '../../primitives/sheet';
import { FormAlert } from '../../auth/FormAlert';
import { ACTIVITY_OPTIONS, useLeadActivity } from './useLeads';

export function ActivityForm({ leadId }: { leadId: string }) {
  const a = useLeadActivity(leadId);
  const [type, setType] = useState('note');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void a.log(type, f.get('body'), String(f.get('dueOn') ?? ''));
  }
  const followUp = type === 'follow_up';
  return (
    <form onSubmit={submit} noValidate className="kz-alog" aria-label="Log activity">
      <FormAlert message={a.error} />
      <div className="kz-alog__row">
        <SelectField label="Type" value={type} onChange={(ev) => setType(ev.target.value)}>
          {ACTIVITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        {followUp ? <TextField label="Follow up on" type="date" name="dueOn" error={a.err('dueOn')} /> : null}
      </div>
      <TextareaField
        label={followUp ? 'What to do' : 'Details'}
        name="body"
        rows={3}
        maxLength={5000}
        error={a.err('body')}
      />
      <div className="kz-alog__go">
        <Button type="submit" variant="secondary" loading={a.busy} lead={followUp ? 'calendar' : 'add'}>
          {followUp ? 'Schedule follow-up' : 'Add to log'}
        </Button>
      </div>
    </form>
  );
}

export function CompleteFollowUp({ leadId, activityId }: { leadId: string; activityId: string }) {
  const a = useLeadActivity(leadId);
  return (
    <span className="kz-afu__done">
      <Button size="sm" variant="secondary" lead="check" loading={a.busy} onClick={() => void a.complete(activityId)}>
        Mark done
      </Button>
      {a.error ? (
        <span role="alert" className="kz-error">
          {a.error}
        </span>
      ) : null}
    </span>
  );
}

export function ConvertLead({ leadId, name }: { leadId: string; name: string }) {
  const a = useLeadActivity(leadId);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Convert to client</Button>
      <FormAlert message={a.error} />
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Convert ${name} to a client?`}
        confirmLabel="Convert to client"
        onConfirm={() => a.convert()}
      >
        This creates a client record with the lead&apos;s contact details and marks the lead as won.
      </ConfirmSheet>
    </>
  );
}
