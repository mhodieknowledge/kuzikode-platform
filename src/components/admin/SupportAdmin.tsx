/** Support islands (P4.14): new request on a client's behalf, reply/internal note composer, request controls. */
import { useState, type FormEvent } from 'react';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABEL,
} from '../../shared/support';
import { apiFetch, Button, Checkbox, Field, Input, Select, Textarea } from '../ui';
import { Alert, useAction } from './actions';

export function NewRequestForm({
  clients,
  projects,
  staff,
  initialClientId,
}: {
  clients: { id: string; name: string; number: string }[];
  projects: { id: string; client_id: string; label: string }[];
  staff: { id: string; name: string }[];
  initialClientId: string;
}) {
  const a = useAction();
  const [clientId, setClientId] = useState(initialClientId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await a.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/support', {
        body: {
          clientId,
          subject: f.get('subject'),
          category: f.get('category'),
          priority: f.get('priority'),
          projectId: f.get('projectId') || null,
          assignedTo: f.get('assignedTo') || null,
          body: f.get('body'),
        },
      });
      window.location.assign(`/admin/support/${res.data.id}`);
    });
  }
  const e = a.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="grid gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2">
        <Field label="Client" required error={e['clientId']}>
          <Select
            value={clientId}
            onChange={(ev) => setClientId(ev.target.value)}
            placeholder="Choose a client"
            options={clients.map((c) => ({ value: c.id, label: `${c.name} (${c.number})` }))}
          />
        </Field>
        <Field label="Project" hint="Optional." error={e['projectId']}>
          <Select
            name="projectId"
            defaultValue=""
            options={[
              { value: '', label: 'None' },
              ...projects.filter((p) => p.client_id === clientId).map((p) => ({ value: p.id, label: p.label })),
            ]}
          />
        </Field>
        <Field label="Subject" required error={e['subject']} className="sm:col-span-2">
          <Input name="subject" maxLength={200} />
        </Field>
        <Field label="Category" error={e['category']}>
          <Select name="category" defaultValue="general" options={[...SUPPORT_CATEGORIES]} />
        </Field>
        <Field label="Priority" error={e['priority']}>
          <Select
            name="priority"
            defaultValue="normal"
            options={SUPPORT_PRIORITIES.map((p) => ({ value: p, label: SUPPORT_PRIORITY_LABEL[p] }))}
          />
        </Field>
        <Field label="Assign to" error={e['assignedTo']}>
          <Select
            name="assignedTo"
            defaultValue=""
            options={[{ value: '', label: 'Unassigned' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </Field>
        <Field label="What the client needs" required error={e['body']} className="sm:col-span-2">
          <Textarea name="body" rows={5} maxLength={10_000} />
        </Field>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          Open request
        </Button>
        <a href="/admin/support" className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800">
          Cancel
        </a>
      </div>
    </form>
  );
}

export function ReplyComposer({ requestId, canManage }: { requestId: string; canManage: boolean }) {
  const a = useAction();
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const form = new FormData(ev.currentTarget);
        form.set('internal', String(internal));
        if (status) form.set('status', status);
        else form.delete('status');
        void a.run(async () => {
          await apiFetch(`/api/v1/admin/support/${requestId}/messages`, { method: 'POST', body: form });
          window.location.reload();
        });
      }}
    >
      <Field label={internal ? 'Internal note' : 'Reply to the client'} required error={a.errors['body']}>
        <Textarea name="body" rows={5} maxLength={10_000} />
      </Field>
      <Field
        label="Attachments"
        hint="Up to 5 files (PDF, Office, images, text), 10 MB each."
        error={a.errors['files']}
      >
        <Input name="files" type="file" multiple />
      </Field>
      <Checkbox
        label="Internal note"
        description="Only staff see internal notes. The client is not emailed."
        checked={internal}
        onCheckedChange={setInternal}
      />
      {canManage ? (
        <Field label="Then set the status to" error={a.errors['status']}>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: internal ? 'Leave as it is' : 'Waiting for the client (default)' },
              ...SUPPORT_STATUSES.map((s) => ({ value: s, label: SUPPORT_STATUS_LABEL[s] })),
            ]}
          />
        </Field>
      ) : null}
      <Alert message={a.error} />
      <div>
        <Button type="submit" loading={a.busy}>
          {internal ? 'Add note' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}

export function RequestControls({
  requestId,
  status,
  priority,
  assignedTo,
  staff,
}: {
  requestId: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  staff: { id: string; name: string }[];
}) {
  const a = useAction();
  const save = (patch: Record<string, unknown>) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/support/${requestId}`, { method: 'PATCH', body: patch });
      window.location.reload();
    });
  return (
    <div className="flex flex-col gap-3">
      <Field label="Status">
        <Select
          value={status}
          onChange={(e) => void save({ status: e.target.value })}
          options={SUPPORT_STATUSES.map((s) => ({ value: s, label: SUPPORT_STATUS_LABEL[s] }))}
        />
      </Field>
      <Field label="Priority">
        <Select
          value={priority}
          onChange={(e) => void save({ priority: e.target.value })}
          options={SUPPORT_PRIORITIES.map((p) => ({ value: p, label: SUPPORT_PRIORITY_LABEL[p] }))}
        />
      </Field>
      <Field label="Assigned to">
        <Select
          value={assignedTo ?? ''}
          onChange={(e) => void save({ assignedTo: e.target.value || null })}
          options={[{ value: '', label: 'Unassigned' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </Field>
      <Alert message={a.error} />
    </div>
  );
}
