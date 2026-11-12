import { useCallback, useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

/**
 * Public enquiry submission (contact, quotation request, consultation): logic only, extracted from the old forms (BRIEF B.0).
 * Posts to the unchanged `/api/v1/public/enquiries` contract with the Turnstile token and honeypot; field errors come back
 * joined per field. `build` returns the request body, or `{ errors }` to stop with client-side errors.
 */
export function useEnquiry(
  build: (f: FormData, token: string | null) => Record<string, unknown> | { errors: Record<string, string> },
) {
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = build(new FormData(e.currentTarget), token);
    if ('errors' in body && typeof body.errors === 'object' && body.errors) {
      setErrors(body.errors as Record<string, string>);
      setFormError('Please check the highlighted fields.');
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await apiFetch<{ data: { reference: string } }>('/api/v1/public/enquiries', { body });
      setReference(res.data.reference);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v.join(' ')])));
        setFormError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setFormError('Something went wrong. Please try again.');
      setReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return { submit, errors, formError, busy, reference, onToken, reset };
}
