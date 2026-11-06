/** Shared helpers for admin action islands: one busy/error state per action group and an inline error alert. */
import { useState } from 'react';
import { ApiError } from '../ui';

export function useAction() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { errors, error, busy, run };
}

export function Alert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
      {message}
    </p>
  ) : null;
}
