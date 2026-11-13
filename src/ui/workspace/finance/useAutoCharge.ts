/**
 * "Charge my saved card automatically for this plan" (docs/06 §3b rule 5), logic extracted unchanged from the pre-R5.3
 * AutoCharge island. The consent is recorded and audited server-side; switching cards while on saves straight away.
 */
import { useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

export function useAutoCharge(subscriptionId: string, initialCard: string, current: string | null) {
  const [on, setOn] = useState(!!current);
  const [cardId, setCardId] = useState(current ?? initialCard);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(nextOn: boolean, nextCard: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/portal/services/subscriptions/${encodeURIComponent(subscriptionId)}/auto-charge`, {
        method: 'PUT',
        body: { cardId: nextOn ? nextCard : null },
      });
      setOn(nextOn);
      setMessage(
        nextOn
          ? 'Automatic payment is on. We charge the card on each due date and email you a receipt.'
          : 'Automatic payment is off. We will send you each invoice to pay.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fields)[0]?.[0] ?? err.message) : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const toggle = (next: boolean) => void save(next, cardId);
  const chooseCard = (next: string) => {
    setCardId(next);
    if (on) void save(true, next);
  };

  return { on, cardId, busy, message, error, toggle, chooseCard };
}
