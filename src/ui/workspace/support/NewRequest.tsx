/** "New support request" form (R5.4). Logic in useSupport.ts; labels are the e2e contract. */
import { useState } from 'react';
import { Button, SelectField, TextField, TextareaField } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { AttachField } from './AttachField';
import { useNewRequest } from './useSupport';

export function NewRequest({
  clients,
  projects,
  categories,
}: {
  clients: { id: string; name: string }[];
  projects: { id: string; client_id: string; label: string }[];
  categories: { value: string; label: string }[];
}) {
  const s = useNewRequest();
  const [clientId, setClientId] = useState(clients.length === 1 ? (clients[0]?.id ?? '') : '');
  const clientProjects = projects.filter((p) => p.client_id === clientId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void s.submit(e.currentTarget);
      }}
      noValidate
      className="kz-sform"
      aria-label="New support request"
    >
      <FormAlert message={s.error} />
      {clients.length > 1 ? (
        <SelectField
          label="Company"
          name="clientId"
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          error={s.field('clientId')}
        >
          <option value="">Choose a company</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name="clientId" value={clientId} />
      )}
      <TextField
        label="Subject"
        name="subject"
        maxLength={200}
        autoComplete="off"
        required
        error={s.field('subject')}
      />
      <div className="kz-sform__pair">
        <SelectField label="What is it about?" name="category" defaultValue="general" error={s.field('category')}>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
        {clientProjects.length ? (
          <SelectField label="Project (optional)" name="projectId" defaultValue="" error={s.field('projectId')}>
            <option value="">Not about a project</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </SelectField>
        ) : null}
      </div>
      <TextareaField
        label="How can we help?"
        name="body"
        rows={6}
        maxLength={10_000}
        required
        hint="Tell us what happened, what you expected, and any error messages."
        error={s.field('body')}
      />
      <AttachField error={s.field('files')} />
      <div className="kz-sform__bar">
        <Button type="submit" lead="send" loading={s.busy}>
          Send request
        </Button>
      </div>
    </form>
  );
}
