/** Logic for the project message composer (extracted from the pre-R5.2 ProjectMessageForm): post, then reload to show it. */
import { useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

export function useProjectMessage(projectId: string) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function send(body: string) {
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    try {
      await apiFetch(`/api/v1/portal/projects/${encodeURIComponent(projectId)}/messages`, { body: { body } });
      window.location.reload();
    } catch (err) {
      if (err instanceof ApiError) {
        const f = err.fields['body'];
        setFieldError(f?.join(' '));
        setError(f ? null : err.message);
      } else setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }
  return { send, busy, error, fieldError };
}
