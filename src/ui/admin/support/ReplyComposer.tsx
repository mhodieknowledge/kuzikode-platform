/** Reply to the client or add an internal note (R6.2 group 3). Labels ("Reply to the client" / "Internal note", "Send reply" / "Add note") are the e2e contract. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { SUPPORT_STATUSES, SUPPORT_STATUS_LABEL } from '../../../shared/support';
import { CheckItem } from '../form';
import { useReply } from './useSupport';

export function ReplyComposer({ requestId, canManage }: { requestId: string; canManage: boolean }) {
  const a = useReply(requestId);
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <form
      noValidate
      className="kz-alog"
      onSubmit={(ev) => {
        ev.preventDefault();
        void a.send(new FormData(ev.currentTarget), internal, status);
      }}
    >
      <TextareaField
        label={internal ? 'Internal note' : 'Reply to the client'}
        name="body"
        rows={5}
        maxLength={10_000}
        error={a.err('body')}
      />
      <TextField
        label="Attachments"
        hint="Up to 5 files (PDF, Office, images, text), 10 MB each."
        name="files"
        type="file"
        multiple
        error={a.err('files')}
      />
      <CheckItem checked={internal} onChange={(e) => setInternal(e.target.checked)}>
        Internal note
      </CheckItem>
      <p className="kz-hint">Only staff see internal notes. The client is not emailed.</p>
      {canManage ? (
        <SelectField
          label="Then set the status to"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          error={a.err('status')}
        >
          <option value="">{internal ? 'Leave as it is' : 'Waiting for the client (default)'}</option>
          {SUPPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUPPORT_STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
      ) : null}
      <FormAlert message={a.error} />
      <div className="kz-alog__go">
        <Button type="submit" loading={a.busy} lead={internal ? undefined : 'send'}>
          {internal ? 'Add note' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
