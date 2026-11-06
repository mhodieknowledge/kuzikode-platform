/**
 * Portal support forms (P5.7): open a request (with attachments), reply on a request, mark it resolved, and ask for
 * a subscription to be cancelled. Each posts to `/api/v1/portal/*` and reloads or moves to the request on success.
 */
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, Field, Input, Select, Textarea } from '../ui';

const FILE_HINT = 'Up to 5 files (PDF, Office documents, images or text), 10 MB each.';

function useSubmit() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(Object.keys(err.fields).length ? null : err.message);
      } else setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }
  return { errors, error, busy, run };
}

function Alert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm font-medium text-danger-600">
      {message}
    </p>
  ) : null;
}

/** Drops empty file inputs so the server only sees real attachments. */
function formWithFiles(form: HTMLFormElement): FormData {
  const data = new FormData(form);
  const files = data.getAll('files').filter((f) => f instanceof File && f.size > 0);
  data.delete('files');
  for (const f of files) data.append('files', f);
  return data;
}

export function NewSupportRequest({
  clients,
  projects,
  categories,
}: {
  clients: { id: string; name: string }[];
  projects: { id: string; client_id: string; label: string }[];
  categories: { value: string; label: string }[];
}) {
  const s = useSubmit();
  const [clientId, setClientId] = useState(clients.length === 1 ? (clients[0]?.id ?? '') : '');
  const clientProjects = projects.filter((p) => p.client_id === clientId);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formWithFiles(e.currentTarget);
    void s.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>('/api/v1/portal/support', { method: 'POST', body: data });
      window.location.assign(`/portal/support/${encodeURIComponent(res.data.id)}`);
    });
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="New support request">
      <Alert message={s.error} />
      {clients.length > 1 ? (
        <Field label="Company" required error={s.errors['clientId']}>
          <Select
            name="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            options={[
              { value: '', label: 'Choose a company' },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Field>
      ) : (
        <input type="hidden" name="clientId" value={clientId} />
      )}
      <Field label="Subject" required error={s.errors['subject']}>
        <Input name="subject" maxLength={200} autoComplete="off" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="What is it about?" error={s.errors['category']}>
          <Select name="category" defaultValue="general" options={categories} />
        </Field>
        {clientProjects.length ? (
          <Field label="Project (optional)" error={s.errors['projectId']}>
            <Select
              name="projectId"
              defaultValue=""
              options={[
                { value: '', label: 'Not about a project' },
                ...clientProjects.map((p) => ({ value: p.id, label: p.label })),
              ]}
            />
          </Field>
        ) : null}
      </div>
      <Field
        label="How can we help?"
        hint="Tell us what happened, what you expected, and any error messages."
        required
        error={s.errors['body']}
      >
        <Textarea name="body" rows={6} maxLength={10_000} />
      </Field>
      <Field label="Attachments (optional)" hint={FILE_HINT} error={s.errors['files']}>
        <Input name="files" type="file" multiple />
      </Field>
      <div>
        <Button type="submit" loading={s.busy}>
          Send request
        </Button>
      </div>
    </form>
  );
}

export function SupportReplyForm({ requestId, reopens }: { requestId: string; reopens: boolean }) {
  const s = useSubmit();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formWithFiles(e.currentTarget);
    void s.run(async () => {
      await apiFetch(`/api/v1/portal/support/${encodeURIComponent(requestId)}/messages`, {
        method: 'POST',
        body: data,
      });
      window.location.reload();
    });
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-label="Reply">
      <Alert message={s.error} />
      <Field
        label="Your message"
        hint={reopens ? 'Sending a message reopens this request.' : undefined}
        required
        error={s.errors['body']}
      >
        <Textarea name="body" rows={4} maxLength={10_000} />
      </Field>
      <Field label="Attachments (optional)" hint={FILE_HINT} error={s.errors['files']}>
        <Input name="files" type="file" multiple />
      </Field>
      <div>
        <Button type="submit" loading={s.busy}>
          Send message
        </Button>
      </div>
    </form>
  );
}

export function ResolveRequestButton({ requestId }: { requestId: string }) {
  const s = useSubmit();
  return (
    <div className="flex flex-col gap-2">
      <Alert message={s.error ?? s.errors['status']?.[0] ?? null} />
      <div>
        <Button
          variant="secondary"
          loading={s.busy}
          onClick={() =>
            void s.run(async () => {
              await apiFetch(`/api/v1/portal/support/${encodeURIComponent(requestId)}/resolve`, {
                method: 'POST',
                body: {},
              });
              window.location.reload();
            })
          }
        >
          Mark as resolved
        </Button>
      </div>
    </div>
  );
}

/** "Request cancellation" under a subscription: an optional reason, then a billing support request is opened. */
export function CancellationRequest({ subscriptionId, description }: { subscriptionId: string; description: string }) {
  const s = useSubmit();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Request cancellation of ${description}`}
      >
        Request cancellation
      </Button>
    );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
    void s.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>(
        `/api/v1/portal/services/subscriptions/${encodeURIComponent(subscriptionId)}/cancellation`,
        { method: 'POST', body: { reason } },
      );
      window.location.assign(`/portal/support/${encodeURIComponent(res.data.id)}`);
    });
  }
  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col gap-3" aria-label={`Cancel ${description}`}>
      <Alert message={s.error} />
      <p className="text-sm text-ink-600">
        We will open a support request and our team will confirm the cancellation and any final bill with you.
      </p>
      <Field label="Reason (optional)" error={s.errors['reason']}>
        <Textarea name="reason" rows={3} maxLength={2000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={s.busy}>
          Send cancellation request
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Keep my service
        </Button>
      </div>
    </form>
  );
}
