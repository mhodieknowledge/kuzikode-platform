/**
 * Per-plan automatic payment (R5.3, docs/06 §3b rule 5): the client's explicit consent as a checkbox row, the card to charge
 * when more than one is saved, and the outcome as a status line. Logic: useAutoCharge.
 */
import { Icon } from '../../icons/icon';
import { CheckRow } from '../../primitives';
import { cardLabel } from './useSavedCards';
import { useAutoCharge } from './useAutoCharge';

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
  const a = useAutoCharge(subscriptionId, cards[0]?.id ?? '', current);
  return (
    <div className="kz-fauto" role="group" aria-label={`Automatic payment for ${description}`}>
      <CheckRow checked={a.on} disabled={a.busy} onChange={(e) => a.toggle(e.target.checked)}>
        Charge my saved card automatically for this plan
      </CheckRow>
      {cards.length > 1 ? (
        <select
          className="kz-input kz-fauto__card"
          aria-label={`Card for ${description}`}
          value={a.cardId}
          disabled={a.busy}
          onChange={(e) => a.chooseCard(e.target.value)}
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {cardLabel(c)}
            </option>
          ))}
        </select>
      ) : null}
      <p role="status" className="kz-fauto__msg">
        {a.message}
      </p>
      {a.error ? (
        <p role="alert" className="kz-fauto__err">
          <Icon name="status-danger" size={16} />
          {a.error}
        </p>
      ) : null}
    </div>
  );
}

export default AutoCharge;
