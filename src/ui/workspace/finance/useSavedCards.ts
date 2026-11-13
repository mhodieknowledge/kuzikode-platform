/**
 * Saved cards logic (docs/06 §3b rule 4), extracted unchanged from the pre-R5.3 SavedCards island: make a card the default or
 * remove it (deletes the token and stops any automatic charge that used it), then reload to show the result.
 */
import { useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

export interface PortalCard {
  id: string;
  brand: string;
  last4: string | null;
  expiresAt: string | null;
  expired: boolean;
  isDefault: boolean;
  clientName: string;
  autoCharges: { id: string; description: string }[];
}

export const cardLabel = (c: { brand: string; last4: string | null }) =>
  c.last4 ? `${c.brand} •••• ${c.last4}` : c.brand;

export const cardExpiry = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { month: '2-digit', year: '2-digit', timeZone: 'Africa/Harare' }).format(
        new Date(iso),
      )
    : null;

export function useSavedCards() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PortalCard | null>(null);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(null);
    }
  }

  const makeDefault = (c: PortalCard) =>
    act(c.id, () => apiFetch(`/api/v1/portal/saved-cards/${encodeURIComponent(c.id)}/default`, { body: {} }));

  async function confirmRemove() {
    if (!removing) return;
    const id = removing.id;
    await act(id, () => apiFetch(`/api/v1/portal/saved-cards/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  }

  return { busy, error, removing, setRemoving, makeDefault, confirmRemove };
}
