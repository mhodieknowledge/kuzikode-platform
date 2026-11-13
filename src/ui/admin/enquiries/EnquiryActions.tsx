/**
 * Page actions on one enquiry (R6.2): open or create the lead, close, mark as spam, reopen. "Create lead" opens a sheet that
 * asks who the lead is assigned to. Button labels and the dialog are the e2e contract.
 */
import { useState } from 'react';
import { Button, LinkButton, SelectField } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { Sheet } from '../../primitives/sheet';
import { useEnquiryActions, type EnquiryStatus } from './useEnquiry';

export interface StaffOption {
  id: string;
  name: string;
}

export function EnquiryActions({
  enquiryId,
  status,
  leadId,
  canTriage,
  staff,
  meId,
}: {
  enquiryId: string;
  status: EnquiryStatus;
  leadId: string | null;
  canTriage: boolean;
  staff: StaffOption[];
  meId: string;
}) {
  const a = useEnquiryActions(enquiryId);
  const [triaging, setTriaging] = useState(false);
  const [assignee, setAssignee] = useState(staff.some((s) => s.id === meId) ? meId : '');
  return (
    <div className="kz-aacts">
      <div className="kz-ahead__acts">
        {leadId ? (
          <LinkButton href={`/admin/leads/${leadId}`} arrow>
            Open lead
          </LinkButton>
        ) : canTriage && status !== 'spam' ? (
          <Button lead="add" onClick={() => setTriaging(true)}>
            Create lead
          </Button>
        ) : null}
        {status === 'new' || status === 'triaged' ? (
          <>
            <Button variant="secondary" loading={a.busy} onClick={() => void a.setStatus('closed')}>
              Close
            </Button>
            {!leadId ? (
              <Button variant="secondary" loading={a.busy} onClick={() => void a.setStatus('spam')}>
                Mark as spam
              </Button>
            ) : null}
          </>
        ) : (
          <Button variant="secondary" loading={a.busy} onClick={() => void a.setStatus('new')}>
            {status === 'spam' ? 'Not spam' : 'Reopen'}
          </Button>
        )}
      </div>
      {!triaging ? <FormAlert message={a.error} /> : null}
      <Sheet
        open={triaging}
        onClose={() => setTriaging(false)}
        title="Create a lead from this enquiry"
        className="kz-adlg"
        describedBy="triage-desc"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTriaging(false)}>
              Cancel
            </Button>
            <Button type="submit" form="triage-form" loading={a.busy}>
              Create lead
            </Button>
          </>
        }
      >
        <p id="triage-desc" className="kz-adlg__desc">
          The lead copies the contact details, the requested service and the budget.
        </p>
        <form
          id="triage-form"
          noValidate
          className="kz-astack"
          onSubmit={(e) => {
            e.preventDefault();
            void a.createLead(assignee);
          }}
        >
          <FormAlert message={a.error} />
          <SelectField
            label="Assign to"
            value={assignee}
            onChange={(ev) => setAssignee(ev.target.value)}
            error={a.err('assignedTo')}
          >
            <option value="">Nobody yet</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </form>
      </Sheet>
    </div>
  );
}
