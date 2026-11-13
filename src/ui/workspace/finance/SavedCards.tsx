/**
 * Saved cards inside the Payments workspace (R5.3): masked number and expiry only (the token never reaches the browser), the
 * default card marked in gold, "Make default" and "Remove" per card. Removing asks first in a sheet. Logic: useSavedCards.
 */
import { Icon } from '../../icons/icon';
import { Button, ConfirmSheet, StatusPill } from '../../primitives';
import { cardExpiry, cardLabel, useSavedCards, type PortalCard } from './useSavedCards';

export type { PortalCard } from './useSavedCards';

export function SavedCards({ cards, showClient }: { cards: PortalCard[]; showClient: boolean }) {
  const s = useSavedCards();
  return (
    <div className="kz-fcards">
      {s.error ? (
        <p role="alert" className="kz-fcards__alert">
          <Icon name="status-danger" size={16} />
          {s.error}
        </p>
      ) : null}
      <ul className="kz-wlist" data-testid="saved-cards">
        {cards.map((c) => (
          <li key={c.id} className="kz-fcard">
            <span className="kz-fcard__chip" aria-hidden="true">
              <Icon name="wallet" size={16} />
            </span>
            <div className="kz-fcard__main">
              <p className="kz-fcard__name">
                <span className="kz-wmono">{cardLabel(c)}</span>
                {c.isDefault && !c.expired ? (
                  <StatusPill tone="lit" plain>
                    Default
                  </StatusPill>
                ) : null}
              </p>
              <p className={c.expired ? 'kz-fcard__meta is-expired' : 'kz-fcard__meta'}>
                {c.expired
                  ? 'Expired: pay by card once more to save it again.'
                  : c.expiresAt
                    ? `Saved until ${cardExpiry(c.expiresAt)}`
                    : 'Saved'}
                {showClient ? ` · ${c.clientName}` : ''}
              </p>
              {c.autoCharges.length ? (
                <p className="kz-fcard__meta">
                  Pays automatically: {c.autoCharges.map((a) => a.description).join(', ')}
                </p>
              ) : null}
            </div>
            <div className="kz-fcard__acts">
              {!c.isDefault && !c.expired ? (
                <Button variant="secondary" size="sm" loading={s.busy === c.id} onClick={() => void s.makeDefault(c)}>
                  Make default<span className="sr-only"> {cardLabel(c)}</span>
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" lead="delete" onClick={() => s.setRemoving(c)}>
                Remove<span className="sr-only"> {cardLabel(c)}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmSheet
        open={!!s.removing}
        onClose={() => s.setRemoving(null)}
        title="Remove this card?"
        confirmLabel="Remove card"
        danger
        onConfirm={s.confirmRemove}
      >
        {s.removing
          ? `${cardLabel(s.removing)} will be deleted from your account.${s.removing.autoCharges.length ? ' Plans it pays automatically will be billed by invoice instead.' : ''}`
          : null}
      </ConfirmSheet>
    </div>
  );
}

export default SavedCards;
