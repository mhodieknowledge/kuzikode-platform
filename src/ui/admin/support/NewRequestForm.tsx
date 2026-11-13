/** Open a support request on a client's behalf (R6.2 group 3). Labels (Client, Subject, What the client needs, Open request) are the e2e contract. */
import { useState, type FormEvent } from 'react';
import { Button } from '../../primitives/button';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_PRIORITY_LABEL } from '../../../shared/support';
import { FormSection, SaveBar } from '../form';
import { useNewRequest } from './useSupport';

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
  const a = useNewRequest();
  const [clientId, setClientId] = useState(initialClientId);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void a.open({
      clientId,
      subject: f.get('subject'),
      category: f.get('category'),
      priority: f.get('priority'),
      projectId: f.get('projectId') || null,
      assignedTo: f.get('assignedTo') || null,
      body: f.get('body'),
    });
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="r-who" title="Who and what" description="The client the request is for, and what it is about.">
        <SelectField
          label="Client"
          value={clientId}
          onChange={(ev) => setClientId(ev.target.value)}
          error={a.err('clientId')}
        >
          <option value="">Choose a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.number})
            </option>
          ))}
        </SelectField>
        <SelectField label="Project" hint="Optional." name="projectId" defaultValue="" error={a.err('projectId')}>
          <option value="">None</option>
          {projects
            .filter((p) => p.client_id === clientId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </SelectField>
        <TextField label="Subject" name="subject" maxLength={200} error={a.err('subject')} className="kz-span-2" />
        <SelectField label="Category" name="category" defaultValue="general" error={a.err('category')}>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Priority" name="priority" defaultValue="normal" error={a.err('priority')}>
          {SUPPORT_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {SUPPORT_PRIORITY_LABEL[p]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Assign to" name="assignedTo" defaultValue="" error={a.err('assignedTo')}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </FormSection>
      <FormSection
        id="r-body"
        title="The request"
        description="Written as the client would: staff and the client both read it."
        cols={1}
      >
        <TextareaField label="What the client needs" name="body" rows={5} maxLength={10_000} error={a.err('body')} />
      </FormSection>
      <SaveBar error={a.error}>
        <a href="/admin/support" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          Open request
        </Button>
      </SaveBar>
    </form>
  );
}
