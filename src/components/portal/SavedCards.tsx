/**
 * Portal saved cards (docs/06 §3b rule 4): masked number and expiry only (the token never reaches the browser), make
 * default, remove (deletes the token and stops any automatic charge that used the card). And the per-plan opt-in to
 * automatic charges (rule 5), with the client's explicit consent wording.
 */
import { CreditCard } from 'lucide-react';
import { useState } from 'react';
import { ApiError, Button, Checkbox, ConfirmDialog, Select, apiFetch } from '../ui';

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

const label = (c: { brand: string; last4: string | null }) => (c.last4 ? `${c.brand} •••• ${c.last4}` : c.brand);
const expiry = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { month: '2-digit', year: '2-digit', timeZone: 'Africa/Harare' }).format(
        new Date(iso),
      )
    : null;

export function SavedCards({ cards, showClient }: { cards: PortalCard[]; showClient: boolean }) {
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

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-line" data-testid="saved-cards">
        {cards.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <CreditCard size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" />
              <div className="min-w-0">
                <p className="font-semibold text-ink-950">
                  {label(c)}
                  {c.isDefault && !c.expired ? (
                    <span className="ml-2 rounded-xs bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      Default
                    </span>
                  ) : null}
                </p>
                <p className={`text-sm ${c.expired ? 'font-medium text-danger-600' : 'text-ink-600'}`}>
                  {c.expired
                    ? 'Expired: pay by card once more to save it again.'
                    : c.expiresAt
                      ? `Saved until ${expiry(c.expiresAt)}`
                      : 'Saved'}
                  {showClient ? ` · ${c.clientName}` : ''}
                </p>
                {c.autoCharges.length ? (
                  <p className="text-sm text-ink-600">
                    Pays automatically: {c.autoCharges.map((s) => s.description).join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!c.isDefault && !c.expired ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === c.id}
                  onClick={() =>
                    void act(c.id, () =>
                      apiFetch(`/api/v1/portal/saved-cards/${encodeURIComponent(c.id)}/default`, { body: {} }),
                    )
                  }
                >
                  Make default<span className="sr-only"> {label(c)}</span>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setRemoving(c)}>
                Remove<span className="sr-only"> {label(c)}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        title="Remove this card?"
        description={
          removing
            ? `${label(removing)} will be deleted from your account.${removing.autoCharges.length ? ' Plans it pays automatically will be billed by invoice instead.' : ''}`
            : ''
        }
        confirmLabel="Remove card"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          const id = removing.id;
          await act(id, () => apiFetch(`/api/v1/portal/saved-cards/${encodeURIComponent(id)}`, { method: 'DELETE' }));
        }}
      />
    </div>
  );
}

/** "Charge my saved card automatically for this plan" (explicit consent, recorded and audited server-side). */
export function AutoCharge({
  subscriptionId,
  description,
  cards,
  current,
}: {
  subscriptionId: string;
  description: string;
  cards: { id: string; brand: string; last4: string | null }[];
  current: string | null;
}) {
  const [on, setOn] = useState(!!current);
  const [cardId, setCardId] = useState(current ?? cards[0]?.id ?? '');
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

  return (
    <div className="flex flex-col gap-2 text-left" aria-label={`Automatic payment for ${description}`} role="group">
      <Checkbox
        label="Charge my saved card automatically for this plan"
        checked={on}
        disabled={busy}
        onCheckedChange={(v) => void save(v, cardId)}
      />
      {cards.length > 1 ? (
        <Select
          aria-label={`Card for ${description}`}
          value={cardId}
          disabled={busy}
          options={cards.map((c) => ({ value: c.id, label: label(c) }))}
          onChange={(e) => {
            setCardId(e.target.value);
            if (on) void save(true, e.target.value);
          }}
        />
      ) : null}
      <p role="status" className="text-[13px] text-ink-600">
        {message}
      </p>
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
