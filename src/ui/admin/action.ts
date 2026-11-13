/**
 * One busy / error state per admin action group (R6.2), logic carried over unchanged from the pre-R6.2 admin islands
 * (`components/admin/actions.tsx`): field errors from a 422 go to the fields, everything else becomes one form-level message.
 */
import { useState } from 'react';
import { ApiError } from '../lib/api';

export type FieldErrors = Record<string, string[]>;

export const CHECK_FIELDS = 'Please check the highlighted fields.';
export const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Maps a thrown error to the form-level message and the per-field errors. */
export function describeError(err: unknown): { message: string; fields: FieldErrors } {
  if (err instanceof ApiError) return { message: err.status === 422 ? CHECK_FIELDS : err.message, fields: err.fields };
  return { message: GENERIC_ERROR, fields: {} };
}

/** First message for a field key (`items.0.description`), for the Field `error` prop. */
export const fieldError = (errors: FieldErrors, key: string): string | undefined => errors[key]?.[0];

export function useAdminAction() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await fn();
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setError(d.message);
    } finally {
      setBusy(false);
    }
  };
  const err = (key: string) => fieldError(errors, key);
  return { errors, error, busy, run, err };
}

export const reload = () => window.location.reload();
