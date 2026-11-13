/**
 * Small presentational parts of the checkout (R4.8): the road strip of a payment's progress (DESIGN_DIRECTION §3: done / now in
 * gold / next), the fee ledger (IMG_5016: the fee on its own line before the total) and the money / time formatters.
 */
import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon';
import { cx } from '../../primitives/cx';

export type StopState = 'done' | 'now' | 'next' | 'failed';
export interface Stop {
  label: string;
  state: StopState;
}

const STATE_TEXT: Record<StopState, string> = {
  done: ' (done)',
  now: ' (current step)',
  next: ' (next)',
  failed: ' (not completed)',
};

/** Three stops on a short road. The current stop is lit gold and marked `aria-current="step"`. */
export function RoadStrip({ stops, label = 'Payment progress' }: { stops: Stop[]; label?: string }) {
  return (
    <ol className="kz-coroad" aria-label={label}>
      {stops.map((s, i) => (
        <li
          key={s.label}
          className="kz-coroad__stop"
          data-state={s.state}
          aria-current={s.state === 'now' ? 'step' : undefined}
        >
          <span className="kz-coroad__mark" aria-hidden="true">
            {s.state === 'done' ? (
              <Icon name="check" size={16} />
            ) : s.state === 'failed' ? (
              <Icon name="close" size={16} />
            ) : (
              String(i + 1).padStart(2, '0')
            )}
          </span>
          <span className="kz-coroad__label">
            {s.label}
            <span className="sr-only">{STATE_TEXT[s.state]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Key / value rows with mono figures; the last row can be the total. */
export function Ledger({
  rows,
  className,
}: {
  rows: { k: ReactNode; v: ReactNode; total?: boolean; mono?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cx('kz-coledger', className)}>
      {rows.map((r, i) => (
        <div key={i} className={cx('kz-coledger__row', r.total && 'kz-coledger__row--total')}>
          <dt>{r.k}</dt>
          <dd className={r.mono === false ? undefined : 'kz-mono'}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const clock = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(
    new Date(iso),
  );

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
