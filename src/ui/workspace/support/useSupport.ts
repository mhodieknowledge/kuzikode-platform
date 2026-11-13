/**
 * Logic of the workspace support forms (extracted from the pre-R5.4 components/portal/SupportForms.tsx, unchanged in behaviour):
 * open a request (with attachments), reply, mark resolved, and ask for a subscription to be cancelled. Each posts to
 * /api/v1/portal/* and reloads or moves to the request on success (so `busy` stays on while the page changes).
 */
import { useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

export const FILE_HINT = 'Up to 5 files (PDF, Office documents, images or text), 10 MB each.';

export function useSupportSubmit() {
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
  const field = (name: string) => errors[name]?.join(' ');
  return { errors, field, error, busy, run };
}

/** Drops empty file inputs so the server only sees real attachments. */
export function formWithFiles(form: HTMLFormElement): FormData {
  const data = new FormData(form);
  const files = data.getAll('files').filter((f) => f instanceof File && f.size > 0);
  data.delete('files');
  for (const f of files) data.append('files', f);
  return data;
}

const go = (href: string) => window.location.assign(href);
const enc = encodeURIComponent;

export function useNewRequest() {
  const s = useSupportSubmit();
  const submit = (form: HTMLFormElement) => {
    const data = formWithFiles(form);
    return s.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>('/api/v1/portal/support', { method: 'POST', body: data });
      go(`/portal/support/${enc(res.data.id)}`);
    });
  };
  return { ...s, submit };
}

export function useReply(requestId: string) {
  const s = useSupportSubmit();
  const submit = (form: HTMLFormElement) => {
    const data = formWithFiles(form);
    return s.run(async () => {
      await apiFetch(`/api/v1/portal/support/${enc(requestId)}/messages`, { method: 'POST', body: data });
      window.location.reload();
    });
  };
  return { ...s, submit };
}

export function useResolve(requestId: string) {
  const s = useSupportSubmit();
  const resolve = () =>
    s.run(async () => {
      await apiFetch(`/api/v1/portal/support/${enc(requestId)}/resolve`, { method: 'POST', body: {} });
      window.location.reload();
    });
  return { ...s, resolve };
}

/** "Request cancellation" of a subscription: an optional reason, then a billing support request is opened. */
export function useCancellation(subscriptionId: string) {
  const s = useSupportSubmit();
  const submit = (reason: string) =>
    s.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>(
        `/api/v1/portal/services/subscriptions/${enc(subscriptionId)}/cancellation`,
        { method: 'POST', body: { reason } },
      );
      go(`/portal/support/${enc(res.data.id)}`);
    });
  return { ...s, submit };
}
