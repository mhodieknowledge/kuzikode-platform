/** Accept / decline submission for a quotation (logic extracted unchanged from the pre-redesign QuotationResponse). */
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../lib/api';

export type Decision = 'accept' | 'reject';

export function useQuotationResponse({ url, doneHref }: { url: string; doneHref?: string | undefined }) {
  const [mode, setMode] = useState<Decision>('accept');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | 'accepted' | 'rejected'>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const body =
        mode === 'accept'
          ? { decision: 'accept', name: f.get('name'), agree }
          : { decision: 'reject', reason: f.get('reason') };
      const res = await apiFetch<{ data: { status: 'accepted' | 'rejected' } }>(url, { body });
      if (doneHref) {
        window.location.assign(doneHref);
        return;
      }
      setDone(res.data.status);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return { mode, setMode, agree, setAgree, errors, error, busy, done, submit };
}
