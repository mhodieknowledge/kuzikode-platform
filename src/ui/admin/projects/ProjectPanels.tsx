/**
 * Project detail islands (R6.2 group 3): milestones, task board / list, update and message composers, file upload and file
 * actions, progress settings. Button names ("Add milestone", "Post update", "Upload", "Delete <title>") and field labels
 * ("Milestone title", "Post an update", "Label") are the e2e contract.
 */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Segmented } from '../../primitives/segmented';
import {
  FILE_KINDS,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
} from '../../../shared/projects';
import { CheckItem } from '../form';
import { PaneBox } from '../PaneBox';
import { milestoneMeta, PRIORITY_LABEL, taskMeta } from './labels';
import { useProjectRecord, type Milestone, type Staff, type Task } from './useProjects';

// ---------------------------------------------------------------- milestones

export function MilestonesPanel({
  projectId,
  milestones,
  invoices,
  canManage,
}: {
  projectId: string;
  milestones: Milestone[];
  invoices: { id: string; number: string }[];
  canManage: boolean;
}) {
  const a = useProjectRecord(projectId);
  const [adding, setAdding] = useState(false);
  const [visible, setVisible] = useState(true);
  return (
    <PaneBox
      id="ms-title"
      title="Milestones"
      meta={String(milestones.length)}
      flush
      actions={
        canManage && !adding ? (
          <Button size="sm" variant="secondary" lead="add" onClick={() => setAdding(true)}>
            Add milestone
          </Button>
        ) : null
      }
    >
      {a.error && !adding ? (
        <div className="kz-apad">
          <FormAlert message={a.error} />
        </div>
      ) : null}
      {milestones.length === 0 && !adding ? (
        <p className="kz-anone">
          <span className="kz-anone__code">0 milestones</span>No milestones yet.
        </p>
      ) : null}
      {milestones.length ? (
        <ul className="kz-alist">
          {milestones.map((m) => (
            <li key={m.id}>
              <div className="kz-alist__main">
                <span className="kz-alist__t">{m.title}</span>
                <span className="kz-alist__m">{milestoneMeta(m)}</span>
              </div>
              {canManage ? (
                <div className="kz-arow-acts">
                  <select
                    className="kz-input kz-ainline"
                    aria-label={`Status of ${m.title}`}
                    value={m.status}
                    onChange={(e) => void a.saveMilestone(m, { status: e.target.value })}
                  >
                    {MILESTONE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {MILESTONE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void a.saveMilestone(m, { clientVisible: m.client_visible !== 1 })}
                  >
                    {m.client_visible ? 'Hide from client' : 'Show to client'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Delete ${m.title}`}
                    onClick={() => void a.deleteMilestone(m.id)}
                  >
                    Delete
                  </Button>
                </div>
              ) : (
                <span className="kz-alist__r">
                  {MILESTONE_STATUS_LABEL[m.status as keyof typeof MILESTONE_STATUS_LABEL]}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <form
          noValidate
          className="kz-apad kz-apad--b kz-afsec__body kz-afsec__body--2"
          onSubmit={(ev) => {
            ev.preventDefault();
            void a.addMilestone(new FormData(ev.currentTarget), visible);
          }}
        >
          <TextField
            label="Milestone title"
            name="title"
            maxLength={200}
            error={a.err('title')}
            className="kz-span-2"
          />
          <TextField label="Due date" name="dueDate" type="date" error={a.err('dueDate')} />
          <SelectField
            label="Linked invoice"
            hint="Optional."
            name="invoiceId"
            defaultValue=""
            error={a.err('invoiceId')}
          >
            <option value="">None</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number}
              </option>
            ))}
          </SelectField>
          <TextareaField
            label="Description"
            name="description"
            rows={2}
            maxLength={2000}
            error={a.err('description')}
            className="kz-span-2"
          />
          <CheckItem className="kz-span-2" checked={visible} onChange={(e) => setVisible(e.target.checked)}>
            Visible to the client
          </CheckItem>
          {a.error ? <FormAlert message={a.error} /> : null}
          <div className="kz-aacts-row kz-span-2">
            <Button type="submit" loading={a.busy}>
              Add milestone
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </PaneBox>
  );
}

// ---------------------------------------------------------------- tasks

export function TaskBoard({
  projectId,
  tasks,
  milestones,
  staff,
  canManage,
  userId,
}: {
  projectId: string;
  tasks: Task[];
  milestones: { id: string; title: string }[];
  staff: Staff[];
  canManage: boolean;
  userId: string;
}) {
  const a = useProjectRecord(projectId);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [adding, setAdding] = useState(false);
  const mayMove = (t: Task) => canManage || t.assignee_id === userId;
  const milestone = (id: string | null) => milestones.find((m) => m.id === id)?.title;
  const controls = (t: Task) =>
    mayMove(t) ? (
      <div className="kz-aboard__ctl">
        <select
          className="kz-input"
          aria-label={`Status of ${t.title}`}
          value={t.status}
          onChange={(e) => void a.moveTask(t.id, e.target.value)}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {canManage ? (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Delete ${t.title}`}
            onClick={() => void a.deleteTask(t.id)}
          >
            Delete
          </Button>
        ) : null}
      </div>
    ) : null;
  return (
    <PaneBox
      id="tasks-title"
      title="Tasks"
      meta={String(tasks.length)}
      flush
      actions={
        <>
          <Segmented
            label="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
          {canManage && !adding ? (
            <Button size="sm" variant="secondary" lead="add" onClick={() => setAdding(true)}>
              Add task
            </Button>
          ) : null}
        </>
      }
    >
      {a.error && !adding ? (
        <div className="kz-apad">
          <FormAlert message={a.error} />
        </div>
      ) : null}
      {adding ? (
        <form
          noValidate
          className="kz-apad kz-apad--b kz-afsec__body kz-afsec__body--2"
          onSubmit={(ev) => {
            ev.preventDefault();
            void a.addTask(new FormData(ev.currentTarget));
          }}
        >
          <TextField label="Task" name="title" maxLength={200} error={a.err('title')} className="kz-span-2" />
          <SelectField label="Assignee" name="assigneeId" defaultValue="" error={a.err('assigneeId')}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Milestone" name="milestoneId" defaultValue="" error={a.err('milestoneId')}>
            <option value="">None</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </SelectField>
          <SelectField label="Priority" name="priority" defaultValue="normal">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </SelectField>
          <TextField label="Due date" name="dueDate" type="date" error={a.err('dueDate')} />
          {a.error ? <FormAlert message={a.error} /> : null}
          <div className="kz-aacts-row kz-span-2">
            <Button type="submit" loading={a.busy}>
              Add task
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {tasks.length === 0 ? (
        <p className="kz-anone">
          <span className="kz-anone__code">0 tasks</span>No tasks yet.
        </p>
      ) : view === 'board' ? (
        <div className="kz-apad">
          <div className="kz-aboard kz-aboard--4">
            {TASK_STATUSES.map((s) => {
              const col = tasks.filter((t) => t.status === s);
              return (
                <section key={s} className="kz-aboard__col" aria-label={TASK_STATUS_LABEL[s]}>
                  <h3 className="kz-aboard__h">
                    <span>{TASK_STATUS_LABEL[s]}</span>
                    <span className="kz-aboard__n">{col.length}</span>
                  </h3>
                  {col.length === 0 ? (
                    <p className="kz-aboard__none">none</p>
                  ) : (
                    <ul className="kz-aboard__list">
                      {col.map((t) => (
                        <li key={t.id} className="kz-aboard__card is-static">
                          <span className="kz-aboard__t">{t.title}</span>
                          <span className="kz-aboard__m">{taskMeta(t, milestone(t.milestone_id))}</span>
                          {controls(t)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="kz-alist">
          {tasks.map((t) => (
            <li key={t.id}>
              <div className="kz-alist__main">
                <span className="kz-alist__t">{t.title}</span>
                <span className="kz-alist__m">{taskMeta(t, milestone(t.milestone_id))}</span>
              </div>
              {controls(t)}
            </li>
          ))}
        </ul>
      )}
    </PaneBox>
  );
}

// ---------------------------------------------------------------- updates, files, messages, settings

export function UpdateComposer({ projectId }: { projectId: string }) {
  const a = useProjectRecord(projectId);
  const [toClient, setToClient] = useState(true);
  return (
    <form
      noValidate
      className="kz-alog"
      onSubmit={(ev) => {
        ev.preventDefault();
        void a.postUpdate(new FormData(ev.currentTarget), toClient);
      }}
    >
      <TextareaField label="Post an update" name="body" rows={3} maxLength={5000} error={a.err('body')} />
      <CheckItem checked={toClient} onChange={(e) => setToClient(e.target.checked)}>
        Share with the client
      </CheckItem>
      <p className="kz-hint">The client&apos;s main contact is emailed and portal users are notified.</p>
      {a.err('body') ? null : <FormAlert message={a.error} />}
      <div className="kz-alog__go">
        <Button type="submit" loading={a.busy}>
          Post update
        </Button>
      </div>
    </form>
  );
}

export function FileUploader({ projectId }: { projectId: string }) {
  const a = useProjectRecord(projectId);
  const [kind, setKind] = useState('deliverable');
  const [visible, setVisible] = useState(true);
  return (
    <form
      noValidate
      className="kz-alog"
      onSubmit={(ev) => {
        ev.preventDefault();
        const form = new FormData(ev.currentTarget);
        form.set('kind', kind);
        form.set('clientVisible', String(kind !== 'internal' && visible));
        void a.uploadFile(form);
      }}
    >
      <TextField
        label="File"
        name="file"
        type="file"
        hint="PDF, Office, image, text or ZIP up to 10 MB."
        error={a.err('file')}
      />
      <TextField label="Label" name="label" maxLength={200} error={a.err('label')} />
      <SelectField label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
        {FILE_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </SelectField>
      <CheckItem
        checked={kind !== 'internal' && visible}
        disabled={kind === 'internal'}
        onChange={(e) => setVisible(e.target.checked)}
      >
        Visible to the client
      </CheckItem>
      <FormAlert message={a.error} />
      <div className="kz-alog__go">
        <Button type="submit" loading={a.busy} lead="upload">
          Upload
        </Button>
      </div>
    </form>
  );
}

export function FileActions({
  projectId,
  id,
  label,
  kind,
  clientVisible,
}: {
  projectId: string;
  id: string;
  label: string;
  kind: string;
  clientVisible: boolean;
}) {
  const a = useProjectRecord(projectId);
  return (
    <div className="kz-arow-acts">
      {kind !== 'internal' ? (
        <Button
          size="sm"
          variant="secondary"
          loading={a.busy}
          onClick={() => void a.setFileVisibility(id, !clientVisible)}
        >
          {clientVisible ? 'Hide from client' : 'Show to client'}
        </Button>
      ) : null}
      <Button size="sm" variant="secondary" aria-label={`Delete ${label}`} onClick={() => void a.deleteFile(id)}>
        Delete
      </Button>
      <FormAlert message={a.error} />
    </div>
  );
}

export function MessageComposer({ projectId }: { projectId: string }) {
  const a = useProjectRecord(projectId);
  return (
    <form
      noValidate
      className="kz-alog"
      onSubmit={(ev) => {
        ev.preventDefault();
        void a.sendMessage(new FormData(ev.currentTarget));
      }}
    >
      <TextareaField label="Message to the client" name="body" rows={3} maxLength={5000} error={a.err('body')} />
      {a.err('body') ? null : <FormAlert message={a.error} />}
      <div className="kz-alog__go">
        <Button type="submit" loading={a.busy} lead="send">
          Send message
        </Button>
      </div>
    </form>
  );
}

export function ProgressSettings({
  projectId,
  mode,
  pct,
  notes,
}: {
  projectId: string;
  mode: 'auto' | 'manual';
  pct: number;
  notes: string | null;
}) {
  const a = useProjectRecord(projectId);
  const [m, setM] = useState(mode);
  return (
    <form
      noValidate
      className="kz-alog"
      onSubmit={(ev) => {
        ev.preventDefault();
        void a.saveSettings(m, new FormData(ev.currentTarget));
      }}
    >
      <SelectField label="Progress" value={m} onChange={(e) => setM(e.target.value as 'auto' | 'manual')}>
        <option value="auto">Automatic (from tasks or milestones)</option>
        <option value="manual">Set by hand</option>
      </SelectField>
      {m === 'manual' ? (
        <TextField
          label="Progress (%)"
          name="progressPct"
          type="number"
          min={0}
          max={100}
          defaultValue={pct}
          inputMode="numeric"
          error={a.err('progressPct')}
        />
      ) : null}
      <TextareaField
        label="Internal notes"
        hint="Never shown to the client."
        name="internalNotes"
        rows={4}
        defaultValue={notes ?? ''}
        maxLength={10_000}
        error={a.err('internalNotes')}
      />
      <FormAlert message={a.error} />
      <div className="kz-alog__go">
        <Button type="submit" variant="secondary" loading={a.busy}>
          Save
        </Button>
      </div>
    </form>
  );
}
