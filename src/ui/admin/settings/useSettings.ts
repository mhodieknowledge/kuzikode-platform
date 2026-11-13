/**
 * Logic of the admin settings islands (R6.2 group 3), carried over unchanged from the pre-redesign
 * `components/admin/SettingsAdmin.tsx`: one save state per form (field errors, a form-level message, a "Saved." line) and the
 * endpoints for sections, logo, numbering, currencies, tax rates, payment accounts, the test email and notification preferences.
 */
import { useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import { CHECK_FIELDS, GENERIC_ERROR, type FieldErrors } from '../action';

export function useSave() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    setSaved(null);
    try {
      const msg = await fn();
      setSaved(msg || 'Saved.');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.status === 422 ? CHECK_FIELDS : err.message);
      } else setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };
  const err = (key: string) => errors[key]?.[0];
  return { errors, error, saved, busy, run, err };
}

/** Body of a section save from the form values and the switches. */
export function sectionBody(
  fields: { key: string; type: string }[],
  f: FormData,
  bools: Record<string, boolean>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'bool') body[field.key] = bools[field.key] ?? false;
    else if (field.type === 'int') body[field.key] = Number(f.get(field.key));
    else body[field.key] = String(f.get(field.key) ?? '');
  }
  return body;
}

/** "2.5" or "2,5" to basis points; -1 when it is not a number (the server rejects it with a field message). */
export function percentToBp(text: string): number {
  const pct = Number(text.replace(',', '.'));
  return Number.isFinite(pct) ? Math.round(pct * 100) : -1;
}

export const settingsApi = <T>(path: string, init?: { method?: string; body?: unknown }) =>
  apiFetch<T>(`/api/v1/admin/settings${path}`, init);

export const reloadPage = () => window.location.reload();
