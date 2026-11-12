import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

/** Newsletter sign-up (docs/12 §C.10): double opt-in, so success means "check your inbox". Endpoint contract unchanged. */
export function useNewsletter(source: string) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('busy');
    setError(null);
    try {
      await apiFetch('/api/v1/public/newsletter', {
        body: { email: f.get('email'), source, website: f.get('website') },
      });
      setState('sent');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fields['email']?.join(' ') ?? err.message)
          : 'Something went wrong. Please try again.',
      );
      setState('idle');
    }
  }
  return { state, error, submit };
}
