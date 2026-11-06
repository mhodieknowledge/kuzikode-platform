/** "Write to the team" box under a project's message thread (P5.6). Reloads the page to show the new message. */
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, Field, Textarea } from '../ui';

export function ProjectMessageForm({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = String(new FormData(e.currentTarget).get('body') ?? '');
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    try {
      await apiFetch(`/api/v1/portal/projects/${encodeURIComponent(projectId)}/messages`, { body: { body } });
      window.location.reload();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldError(err.fields['body']);
        setError(err.fields['body'] ? null : err.message);
      } else setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
      <Field label="Message to the Kuzikode team" required error={fieldError}>
        <Textarea name="body" rows={4} maxLength={5000} />
      </Field>
      <div>
        <Button type="submit" loading={busy}>
          Send message
        </Button>
      </div>
    </form>
  );
}
