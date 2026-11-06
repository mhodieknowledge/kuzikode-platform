/** Admin → Time islands (P4.23): timer, time entry dialog + list actions, and billing unbilled time. */
import { useEffect, useState } from 'react';
import { apiFetch, Button, Checkbox, ConfirmDialog, Dialog, Field, Input, Select, Textarea } from '../ui';
import { Alert, useAction } from './actions';
import { formatMinutes } from '../../shared/schemas/time';

const api = (path: string, init: { method?: string; body?: unknown } = {}) =>
  apiFetch<{ data: Record<string, unknown> | null }>(`/api/v1/admin/time${path}`, init);
const reload = () => window.location.reload();

export interface ProjectOption {
  id: string;
  label: string;
  tasks: { id: string; title: string }[];
}

export interface EntryValues {
  id?: string;
  projectId: string;
  taskId: string | null;
  entryDate: string;
  minutes: number;
  description: string | null;
  billable: boolean;
}

function ProjectTaskFields({
  projects,
  projectId,
  taskId,
  onProject,
  onTask,
  errors,
}: {
  projects: ProjectOption[];
  projectId: string;
  taskId: string | null;
  onProject: (id: string) => void;
  onTask: (id: string | null) => void;
  errors: Record<string, string[]>;
}) {
  const tasks = projects.find((p) => p.id === projectId)?.tasks ?? [];
  return (
    <>
      <Field label="Project" required error={errors['projectId']}>
        <Select
          value={projectId}
          onChange={(e) => {
            onProject(e.target.value);
            onTask(null);
          }}
          options={[
            { value: '', label: 'Choose a project' },
            ...projects.map((p) => ({ value: p.id, label: p.label })),
          ]}
        />
      </Field>
      <Field label="Task" hint="Optional." error={errors['taskId']}>
        <Select
          value={taskId ?? ''}
          onChange={(e) => onTask(e.target.value || null)}
          options={[{ value: '', label: 'No task' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
        />
      </Field>
    </>
  );
}

/** Start/stop timer. `running` comes from the server so a reload keeps showing it. */
export function TimerWidget({
  projects,
  running,
}: {
  projects: ProjectOption[];
  running: { projectLabel: string; description: string | null; startedAt: string } | null;
}) {
  const a = useAction();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [running]);
  if (running) {
    const minutes = Math.max(0, Math.floor((now - Date.parse(running.startedAt)) / 60_000));
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-brand-600/30 bg-brand-50 p-5">
        <div>
          <p className="text-sm font-semibold text-ink-950">Timer running · {formatMinutes(minutes)}</p>
          <p className="text-sm text-ink-600">
            {running.projectLabel}
            {running.description ? ` · ${running.description}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            loading={a.busy}
            onClick={() => a.run(async () => (await api('/timer/stop', { method: 'POST', body: {} }), reload()))}
          >
            Stop and save
          </Button>
          <Button
            variant="ghost"
            onClick={() => a.run(async () => (await api('/timer/discard', { method: 'POST', body: {} }), reload()))}
          >
            Discard
          </Button>
        </div>
        <Alert message={a.error} />
      </div>
    );
  }
  return (
    <form
      noValidate
      className="grid gap-4 rounded-lg border border-line bg-surface p-5 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(async () => {
          await api('/timer/start', { method: 'POST', body: { projectId, taskId, description, billable: true } });
          reload();
        });
      }}
    >
      <ProjectTaskFields
        projects={projects}
        projectId={projectId}
        taskId={taskId}
        onProject={setProjectId}
        onTask={setTaskId}
        errors={a.errors}
      />
      <Field label="What are you working on?" error={a.errors['description']}>
        <Input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Button type="submit" loading={a.busy} disabled={!projectId}>
        Start timer
      </Button>
      <div className="md:col-span-4">
        <Alert message={a.error} />
      </div>
    </form>
  );
}

/** "Log time" button + dialog; also used for editing an existing entry. */
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
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(entry?.projectId ?? projects[0]?.id ?? '');
  const [taskId, setTaskId] = useState<string | null>(entry?.taskId ?? null);
  const [billable, setBillable] = useState(entry?.billable ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      <Button
        size={entry ? 'sm' : 'md'}
        variant={entry ? 'ghost' : 'secondary'}
        aria-label={entry ? `Edit time entry: ${entry.description ?? entry.entryDate}` : undefined}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={entry ? 'Edit time' : 'Log time'}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const hours = Number(f.get('hours') || 0);
            const mins = Number(f.get('mins') || 0);
            void a.run(async () => {
              await api(entry?.id ? `/entries/${entry.id}` : '/entries', {
                method: entry?.id ? 'PUT' : 'POST',
                body: {
                  projectId,
                  taskId,
                  entryDate: f.get('entryDate'),
                  minutes: Math.round(hours * 60 + mins),
                  description: f.get('description'),
                  billable,
                },
              });
              reload();
            });
          }}
        >
          <ProjectTaskFields
            projects={projects}
            projectId={projectId}
            taskId={taskId}
            onProject={setProjectId}
            onTask={setTaskId}
            errors={a.errors}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" required error={a.errors['entryDate']}>
              <Input name="entryDate" type="date" max={today} defaultValue={entry?.entryDate ?? today} />
            </Field>
            <Field label="Hours" error={a.errors['minutes']}>
              <Input
                name="hours"
                type="number"
                min={0}
                max={24}
                defaultValue={entry ? Math.floor(entry.minutes / 60) : 1}
              />
            </Field>
            <Field label="Minutes">
              <Input
                name="mins"
                type="number"
                min={0}
                max={59}
                step={5}
                defaultValue={entry ? entry.minutes % 60 : 0}
              />
            </Field>
          </div>
          <Field label="Description" error={a.errors['description']}>
            <Textarea name="description" rows={2} maxLength={500} defaultValue={entry?.description ?? ''} />
          </Field>
          <Checkbox label="Billable" checked={billable} onCheckedChange={setBillable} />
          <Alert message={a.error} />
          <div className="flex flex-wrap justify-between gap-2">
            {entry?.id ? (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                Delete entry
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={a.busy}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
      {entry?.id ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this time entry?"
          description="The entry is removed. Billed time can't be deleted."
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            await api(`/entries/${entry.id}`, { method: 'DELETE' });
            reload();
          }}
        />
      ) : null}
    </>
  );
}

export interface UnbilledEntry {
  id: string;
  entry_date: string;
  user_name: string;
  task_title: string | null;
  description: string | null;
  minutes: number;
  amountLabel: string;
  currency: string;
}

/** Choose unbilled entries and put them on a new draft invoice. */
export function BillTime({ projectId, entries }: { projectId: string; entries: UnbilledEntry[] }) {
  const a = useAction();
  const [chosen, setChosen] = useState<string[]>(entries.map((e) => e.id));
  const minutes = entries.filter((e) => chosen.includes(e.id)).reduce((n, e) => n + e.minutes, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-[12px] text-ink-600">
            <tr>
              <th scope="col" className="w-10 px-4 py-2.5">
                <span className="sr-only">Include</span>
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Date
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Person
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Work
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Time
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5">
                  <Checkbox
                    label={<span className="sr-only">{`Include ${e.entry_date} ${e.user_name}`}</span>}
                    checked={chosen.includes(e.id)}
                    onCheckedChange={(c) => setChosen(c ? [...chosen, e.id] : chosen.filter((x) => x !== e.id))}
                  />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{e.entry_date}</td>
                <td className="px-4 py-2.5">{e.user_name}</td>
                <td className="px-4 py-2.5 text-ink-600">
                  {[e.task_title, e.description].filter(Boolean).join(': ') || 'Project work'}
                </td>
                <td className="tnum px-4 py-2.5 text-right">{formatMinutes(e.minutes)}</td>
                <td className="tnum px-4 py-2.5 text-right">{e.amountLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Alert message={a.error ?? (a.errors['entryIds'] ? a.errors['entryIds'].join(' ') : null)} />
      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="lg"
          loading={a.busy}
          disabled={chosen.length === 0}
          onClick={() =>
            a.run(async () => {
              const res = await api(`/projects/${projectId}/bill`, { method: 'POST', body: { entryIds: chosen } });
              window.location.assign(`/admin/invoices/${String(res.data?.['invoiceId'])}`);
            })
          }
        >
          Create draft invoice
        </Button>
        <span className="text-sm text-ink-600">
          {chosen.length} entries · {formatMinutes(minutes)}
        </span>
      </div>
    </div>
  );
}
