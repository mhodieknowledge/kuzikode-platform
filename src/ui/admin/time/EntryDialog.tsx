/**
 * "Log time" button + sheet; also used (label "Edit") for an existing entry in the time list. The sheet is mounted only while
 * open, so a page with many rows carries no hidden duplicate fields. Labels (Project, Hours, Minutes, Description, Save) are the
 * e2e contract.
 */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { TextareaField, TextField } from '../../primitives';
import { ConfirmSheet, Sheet } from '../../primitives/sheet';
import { CheckItem } from '../form';
import { ProjectTaskFields } from './ProjectTaskFields';
import { useEntrySave, type EntryValues, type ProjectOption } from './useTime';

function EntrySheet({
  projects,
  today,
  entry,
  onClose,
}: {
  projects: ProjectOption[];
  today: string;
  entry?: EntryValues | undefined;
  onClose: () => void;
}) {
  const a = useEntrySave(entry?.id);
  const [projectId, setProjectId] = useState(entry?.projectId ?? projects[0]?.id ?? '');
  const [taskId, setTaskId] = useState<string | null>(entry?.taskId ?? null);
  const [billable, setBillable] = useState(entry?.billable ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const formId = `time-entry-${entry?.id ?? 'new'}`;
  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={entry ? 'Edit time' : 'Log time'}
        className="kz-adlg"
        footer={
          <>
            {entry?.id ? (
              <Button variant="quiet" className="kz-adlg__clear" onClick={() => setConfirmDelete(true)}>
                Delete entry
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={a.busy}>
              Save
            </Button>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          className="kz-astack"
          onSubmit={(e) => {
            e.preventDefault();
            void a.save(new FormData(e.currentTarget), { projectId, taskId, billable });
          }}
        >
          <ProjectTaskFields
            projects={projects}
            projectId={projectId}
            taskId={taskId}
            onProject={setProjectId}
            onTask={setTaskId}
            err={a.err}
          />
          <div className="kz-aform3">
            <TextField
              label="Date"
              name="entryDate"
              type="date"
              max={today}
              defaultValue={entry?.entryDate ?? today}
              error={a.err('entryDate')}
            />
            <TextField
              label="Hours"
              name="hours"
              type="number"
              min={0}
              max={24}
              defaultValue={entry ? Math.floor(entry.minutes / 60) : 1}
              error={a.err('minutes')}
            />
            <TextField
              label="Minutes"
              name="mins"
              type="number"
              min={0}
              max={59}
              step={5}
              defaultValue={entry ? entry.minutes % 60 : 0}
            />
          </div>
          <TextareaField
            label="Description"
            name="description"
            rows={2}
            maxLength={500}
            defaultValue={entry?.description ?? ''}
            error={a.err('description')}
          />
          <CheckItem checked={billable} onChange={(e) => setBillable(e.target.checked)}>
            Billable
          </CheckItem>
          <FormAlert message={a.error} />
        </form>
      </Sheet>
      {entry?.id ? (
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Delete this time entry?"
          confirmLabel="Delete"
          danger
          onConfirm={a.remove}
        >
          The entry is removed. Billed time can&apos;t be deleted.
        </ConfirmSheet>
      ) : null}
    </>
  );
}

export function EntryDialogButton({
  projects,
  today,
  entry,
  label = 'Log time',
}: {
  projects: ProjectOption[];
  today: string;
  entry?: EntryValues;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size={entry ? 'sm' : 'md'}
        variant="secondary"
        lead={entry ? undefined : 'add'}
        aria-label={entry ? `Edit time entry: ${entry.description ?? entry.entryDate}` : undefined}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? <EntrySheet projects={projects} today={today} entry={entry} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
