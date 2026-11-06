/** Project islands (P4.12): project form, milestones, task board, updates, files, messages, progress settings. */
import { useState, type FormEvent } from 'react';
import {
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  FILE_KINDS,
  type TaskStatus,
} from '../../shared/projects';
import { apiFetch, Button, Checkbox, DateInput, Field, Input, MoneyInput, Select, Textarea } from '../ui';
import { Alert, useAction } from './actions';

interface Staff {
  id: string;
  name: string;
  email: string;
}

const api = (path: string, init: { method?: string; body?: unknown } = {}) =>
  apiFetch<{ data: { id?: string } }>(`/api/v1/admin/projects${path}`, init);
const reload = () => window.location.reload();
const card = 'rounded-lg border border-line bg-surface p-5';

// ---------------------------------------------------------------- project form

export interface ProjectFormProps {
  id?: string;
  initial: {
    clientId: string;
    name: string;
    description: string | null;
    status: string;
    startDate: string | null;
    targetDate: string | null;
    budgetMinor: number | null;
    currency: string | null;
    leadId: string | null;
    memberIds: string[];
  };
  clients: { id: string; name: string; number: string; currency: string }[];
  staff: Staff[];
  currencies: { code: string; minor_digits: number }[];
}

export function ProjectForm({ id, initial, clients, staff, currencies }: ProjectFormProps) {
  const a = useAction();
  const [clientId, setClientId] = useState(initial.clientId);
  const [status, setStatus] = useState(initial.status);
  const [leadId, setLeadId] = useState(initial.leadId ?? '');
  const [members, setMembers] = useState<string[]>(initial.memberIds);
  const [budget, setBudget] = useState<number | null>(initial.budgetMinor);
  const [currency, setCurrency] = useState(
    initial.currency ?? clients.find((c) => c.id === initial.clientId)?.currency ?? currencies[0]?.code ?? 'USD',
  );
  const digits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      clientId,
      name: f.get('name'),
      description: f.get('description'),
      status,
      startDate: f.get('startDate') || null,
      targetDate: f.get('targetDate') || null,
      budgetMinor: budget,
      currency: budget != null ? currency : null,
      leadId: leadId || null,
      memberIds: members.filter((m) => m !== leadId),
    };
    await a.run(async () => {
      if (id) {
        await api(`/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/projects/${id}`);
      } else {
        const res = await api('', { body });
        window.location.assign(`/admin/projects/${res.data.id}`);
      }
    });
  }
  const e = a.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className={card} aria-labelledby="p-details">
        <h2 id="p-details" className="font-sans text-base font-semibold">
          Details
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Client" required error={e['clientId']}>
            <Select
              value={clientId}
              onChange={(ev) => setClientId(ev.target.value)}
              placeholder="Choose a client"
              options={clients.map((c) => ({ value: c.id, label: `${c.name} (${c.number})` }))}
            />
          </Field>
          <Field label="Status" error={e['status']}>
            <Select
              value={status}
              onChange={(ev) => setStatus(ev.target.value)}
              options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))}
            />
          </Field>
          <Field label="Project name" required error={e['name']} className="sm:col-span-2">
            <Input name="name" defaultValue={initial.name} maxLength={200} />
          </Field>
          <Field label="Description" error={e['description']} className="sm:col-span-2">
            <Textarea name="description" rows={3} defaultValue={initial.description ?? ''} maxLength={5000} />
          </Field>
          <Field label="Start date" error={e['startDate']}>
            <DateInput name="startDate" defaultValue={initial.startDate ?? ''} />
          </Field>
          <Field label="Target date" error={e['targetDate']}>
            <DateInput name="targetDate" defaultValue={initial.targetDate ?? ''} />
          </Field>
          <Field label="Budget" hint="Optional." error={e['budgetMinor']}>
            <MoneyInput valueMinor={budget} onChangeMinor={setBudget} currency={currency} minorDigits={digits} />
          </Field>
          <Field label="Budget currency" error={e['currency']}>
            <Select
              value={currency}
              onChange={(ev) => setCurrency(ev.target.value)}
              options={currencies.map((c) => ({ value: c.code, label: c.code }))}
            />
          </Field>
        </div>
      </section>
      <section className={card} aria-labelledby="p-team">
        <h2 id="p-team" className="font-sans text-base font-semibold">
          Team
        </h2>
        <div className="mt-4 grid gap-4">
          <Field label="Project lead" hint="Leave empty to make yourself the lead." error={e['leadId']}>
            <Select
              value={leadId}
              onChange={(ev) => setLeadId(ev.target.value)}
              options={[{ value: '', label: 'Me' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-950">Members</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {staff
                .filter((s) => s.id !== leadId)
                .map((s) => (
                  <Checkbox
                    key={s.id}
                    label={s.name}
                    description={s.email}
                    checked={members.includes(s.id)}
                    onCheckedChange={(v) => setMembers(v ? [...members, s.id] : members.filter((m) => m !== s.id))}
                  />
                ))}
            </div>
            {e['memberIds'] ? <p className="mt-1 text-[13px] text-danger-600">{e['memberIds'][0]}</p> : null}
          </fieldset>
        </div>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {id ? 'Save project' : 'Create project'}
        </Button>
        <a
          href={id ? `/admin/projects/${id}` : '/admin/projects'}
          className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- milestones

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  client_visible: number;
  invoice_id: string | null;
  invoice_number: string | null;
}

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
  const a = useAction();
  const [adding, setAdding] = useState(false);
  const [visible, setVisible] = useState(true);
  const save = (m: Milestone, patch: Partial<{ status: string; clientVisible: boolean }>) =>
    a.run(async () => {
      await api(`/${projectId}/milestones/${m.id}`, {
        method: 'PUT',
        body: {
          title: m.title,
          description: m.description,
          dueDate: m.due_date,
          status: patch.status ?? m.status,
          clientVisible: patch.clientVisible ?? m.client_visible === 1,
          invoiceId: m.invoice_id,
        },
      });
      reload();
    });
  return (
    <section className={card} aria-labelledby="ms-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ms-title" className="font-sans text-base font-semibold">
          Milestones
        </h2>
        {canManage && !adding ? (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add milestone
          </Button>
        ) : null}
      </div>
      <Alert message={a.error} />
      {milestones.length === 0 && !adding ? <p className="mt-2 text-sm text-ink-600">No milestones yet.</p> : null}
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {milestones.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium text-ink-950">{m.title}</p>
              <p className="text-[12px] text-ink-600">
                {m.due_date ? `Due ${m.due_date}` : 'No due date'}
                {m.client_visible ? ' · visible to the client' : ' · internal'}
                {m.invoice_number ? ` · ${m.invoice_number}` : ''}
              </p>
            </div>
            {canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={`Status of ${m.title}`}
                  value={m.status}
                  onChange={(e) => void save(m, { status: e.target.value })}
                  options={MILESTONE_STATUSES.map((s) => ({ value: s, label: MILESTONE_STATUS_LABEL[s] }))}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void save(m, { clientVisible: m.client_visible !== 1 })}
                >
                  {m.client_visible ? 'Hide from client' : 'Show to client'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${m.title}`}
                  onClick={() =>
                    a.run(async () => {
                      await api(`/${projectId}/milestones/${m.id}`, { method: 'DELETE' });
                      reload();
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            ) : (
              <span className="text-[13px] text-ink-800">
                {MILESTONE_STATUS_LABEL[m.status as keyof typeof MILESTONE_STATUS_LABEL]}
              </span>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          noValidate
          className="mt-3 grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(`/${projectId}/milestones`, {
                body: {
                  title: f.get('title'),
                  description: f.get('description'),
                  dueDate: f.get('dueDate') || null,
                  clientVisible: visible,
                  invoiceId: f.get('invoiceId') || null,
                },
              });
              reload();
            });
          }}
        >
          <Field label="Milestone title" required error={a.errors['title']} className="sm:col-span-2">
            <Input name="title" maxLength={200} />
          </Field>
          <Field label="Due date" error={a.errors['dueDate']}>
            <DateInput name="dueDate" />
          </Field>
          <Field label="Linked invoice" hint="Optional." error={a.errors['invoiceId']}>
            <Select
              name="invoiceId"
              defaultValue=""
              options={[{ value: '', label: 'None' }, ...invoices.map((i) => ({ value: i.id, label: i.number }))]}
            />
          </Field>
          <Field label="Description" error={a.errors['description']} className="sm:col-span-2">
            <Textarea name="description" rows={2} maxLength={2000} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox label="Visible to the client" checked={visible} onCheckedChange={setVisible} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={a.busy}>
              Add milestone
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- tasks

interface Task {
  id: string;
  milestone_id: string | null;
  title: string;
  assignee_id: string | null;
  assignee_name: string | null;
  status: string;
  priority: string;
  due_date: string | null;
}

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
  const a = useAction();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [adding, setAdding] = useState(false);
  const move = (t: Task, status: string) =>
    a.run(async () => {
      await api(`/${projectId}/tasks/${t.id}/move`, { body: { status } });
      reload();
    });
  const mayMove = (t: Task) => canManage || t.assignee_id === userId;
  const milestone = (id: string | null) => milestones.find((m) => m.id === id)?.title;
  const row = (t: Task) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ink-950">{t.title}</p>
      <p className="text-[12px] text-ink-600">
        {t.assignee_name ?? 'Unassigned'}
        {t.due_date ? ` · due ${t.due_date}` : ''}
        {t.priority !== 'normal' ? ` · ${t.priority}` : ''}
        {milestone(t.milestone_id) ? ` · ${milestone(t.milestone_id)}` : ''}
      </p>
      {mayMove(t) ? (
        <div className="flex items-center gap-2">
          <Select
            aria-label={`Status of ${t.title}`}
            value={t.status}
            onChange={(e) => void move(t, e.target.value)}
            options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
          />
          {canManage ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete ${t.title}`}
              onClick={() =>
                a.run(async () => {
                  await api(`/${projectId}/tasks/${t.id}`, { method: 'DELETE' });
                  reload();
                })
              }
            >
              Delete
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
  return (
    <section className={card} aria-labelledby="tasks-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tasks-title" className="font-sans text-base font-semibold">
          Tasks
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" aria-pressed={view === 'board'} onClick={() => setView('board')}>
            Board
          </Button>
          <Button size="sm" variant="ghost" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            List
          </Button>
          {canManage && !adding ? (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              Add task
            </Button>
          ) : null}
        </div>
      </div>
      <Alert message={a.error} />
      {adding ? (
        <form
          noValidate
          className="mt-4 grid gap-3 rounded-sm border border-line p-4 sm:grid-cols-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(`/${projectId}/tasks`, {
                body: {
                  title: f.get('title'),
                  milestoneId: f.get('milestoneId') || null,
                  assigneeId: f.get('assigneeId') || null,
                  priority: f.get('priority'),
                  dueDate: f.get('dueDate') || null,
                },
              });
              reload();
            });
          }}
        >
          <Field label="Task" required error={a.errors['title']} className="sm:col-span-2">
            <Input name="title" maxLength={200} />
          </Field>
          <Field label="Assignee" error={a.errors['assigneeId']}>
            <Select
              name="assigneeId"
              defaultValue=""
              options={[{ value: '', label: 'Unassigned' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <Field label="Milestone" error={a.errors['milestoneId']}>
            <Select
              name="milestoneId"
              defaultValue=""
              options={[{ value: '', label: 'None' }, ...milestones.map((m) => ({ value: m.id, label: m.title }))]}
            />
          </Field>
          <Field label="Priority">
            <Select
              name="priority"
              defaultValue="normal"
              options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </Field>
          <Field label="Due date" error={a.errors['dueDate']}>
            <DateInput name="dueDate" />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={a.busy}>
              Add task
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-ink-600">No tasks yet.</p>
      ) : view === 'board' ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((s: TaskStatus) => (
            <div key={s} className="rounded-sm bg-canvas p-3">
              <h3 className="text-[13px] font-semibold text-ink-600">
                {TASK_STATUS_LABEL[s]} ({tasks.filter((t) => t.status === s).length})
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {tasks
                  .filter((t) => t.status === s)
                  .map((t) => (
                    <li key={t.id} className="rounded-sm border border-line bg-surface p-3">
                      {row(t)}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {tasks.map((t) => (
            <li key={t.id} className="py-3">
              {row(t)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- updates, files, messages, settings

export function UpdateComposer({ projectId }: { projectId: string }) {
  const a = useAction();
  const [toClient, setToClient] = useState(true);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        void a.run(async () => {
          await api(`/${projectId}/updates`, {
            body: { body: f.get('body'), visibility: toClient ? 'client' : 'internal' },
          });
          reload();
        });
      }}
    >
      <Field label="Post an update" required error={a.errors['body']}>
        <Textarea name="body" rows={3} maxLength={5000} />
      </Field>
      <Checkbox
        label="Share with the client"
        description="The client's main contact is emailed and portal users are notified."
        checked={toClient}
        onCheckedChange={setToClient}
      />
      <Alert message={a.error} />
      <div>
        <Button type="submit" loading={a.busy}>
          Post update
        </Button>
      </div>
    </form>
  );
}

export function FileUploader({ projectId }: { projectId: string }) {
  const a = useAction();
  const [kind, setKind] = useState('deliverable');
  const [visible, setVisible] = useState(true);
  return (
    <form
      noValidate
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        const form = new FormData(ev.currentTarget);
        form.set('kind', kind);
        form.set('clientVisible', String(kind !== 'internal' && visible));
        void a.run(async () => {
          await apiFetch(`/api/v1/admin/projects/${projectId}/files`, { method: 'POST', body: form });
          reload();
        });
      }}
    >
      <Field label="File" required hint="PDF, Office, image, text or ZIP up to 10 MB." error={a.errors['file']}>
        <Input name="file" type="file" />
      </Field>
      <Field label="Label" required error={a.errors['label']}>
        <Input name="label" maxLength={200} />
      </Field>
      <Field label="Kind">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} options={[...FILE_KINDS]} />
      </Field>
      <div className="flex items-end">
        <Checkbox
          label="Visible to the client"
          checked={kind !== 'internal' && visible}
          disabled={kind === 'internal'}
          onCheckedChange={setVisible}
        />
      </div>
      <Alert message={a.error} />
      <div className="sm:col-span-2">
        <Button type="submit" loading={a.busy}>
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
  const a = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {kind !== 'internal' ? (
        <Button
          size="sm"
          variant="ghost"
          loading={a.busy}
          onClick={() =>
            a.run(async () => {
              await api(`/${projectId}/files/${id}`, { method: 'PUT', body: { clientVisible: !clientVisible } });
              reload();
            })
          }
        >
          {clientVisible ? 'Hide from client' : 'Show to client'}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Delete ${label}`}
        onClick={() =>
          a.run(async () => {
            await api(`/${projectId}/files/${id}`, { method: 'DELETE' });
            reload();
          })
        }
      >
        Delete
      </Button>
      <Alert message={a.error} />
    </div>
  );
}

export function MessageComposer({ projectId }: { projectId: string }) {
  const a = useAction();
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        void a.run(async () => {
          await api(`/${projectId}/messages`, { body: { body: f.get('body') } });
          reload();
        });
      }}
    >
      <Field label="Message to the client" required error={a.errors['body']}>
        <Textarea name="body" rows={3} maxLength={5000} />
      </Field>
      <Alert message={a.error} />
      <div>
        <Button type="submit" loading={a.busy}>
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
  const a = useAction();
  const [m, setM] = useState(mode);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        void a.run(async () => {
          await api(`/${projectId}/settings`, {
            method: 'PUT',
            body: {
              progressMode: m,
              ...(m === 'manual' ? { progressPct: Number(f.get('progressPct') ?? 0) } : {}),
              internalNotes: f.get('internalNotes'),
            },
          });
          reload();
        });
      }}
    >
      <Field label="Progress">
        <Select
          value={m}
          onChange={(e) => setM(e.target.value as 'auto' | 'manual')}
          options={[
            { value: 'auto', label: 'Automatic (from tasks or milestones)' },
            { value: 'manual', label: 'Set by hand' },
          ]}
        />
      </Field>
      {m === 'manual' ? (
        <Field label="Progress (%)" error={a.errors['progressPct']}>
          <Input name="progressPct" type="number" min={0} max={100} defaultValue={pct} inputMode="numeric" />
        </Field>
      ) : null}
      <Field label="Internal notes" hint="Never shown to the client." error={a.errors['internalNotes']}>
        <Textarea name="internalNotes" rows={4} defaultValue={notes ?? ''} maxLength={10_000} />
      </Field>
      <Alert message={a.error} />
      <div>
        <Button type="submit" variant="secondary" loading={a.busy}>
          Save
        </Button>
      </div>
    </form>
  );
}
