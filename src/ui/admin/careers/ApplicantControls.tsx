/** Controls under an applicant card: the stage select (named "Move <name> to") and the bulk "Select" check. */
import { CheckItem } from '../form';
import { stageOptions, type ApplicantCard } from './useCareers';

export function ApplicantControls({
  card,
  selected,
  onMove,
  onSelect,
}: {
  card: ApplicantCard;
  selected: boolean;
  onMove: (to: string) => void;
  onSelect: (on: boolean) => void;
}) {
  return (
    <div className="kz-aboard__ctl">
      <select
        aria-label={`Move ${card.name} to`}
        className="kz-input"
        value={card.status}
        onChange={(e) => onMove(e.target.value)}
      >
        {stageOptions.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {!['rejected', 'withdrawn', 'hired'].includes(card.status) ? (
        <CheckItem checked={selected} onChange={(e) => onSelect(e.target.checked)}>
          Select
        </CheckItem>
      ) : null}
    </div>
  );
}
