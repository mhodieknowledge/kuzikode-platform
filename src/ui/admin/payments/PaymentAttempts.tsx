/**
 * The invoice's online payment attempts with a "Check now" per attempt (R6.2): asks the gateway at once and applies the
 * verified result. Labels and accessible names are the e2e contract.
 */
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { StatusPill } from '../../primitives/display';
import { attemptStatus, formatWhen } from '../finance/labels';
import { useAttempts, type AttemptItem } from './usePayments';

export function PaymentAttempts({ initial }: { initial: AttemptItem[] }) {
  const { items, busyId, message, error, check } = useAttempts(initial);
  return (
    <div className="kz-astack kz-apad kz-apad--b">
      <p aria-live="polite" className="kz-attempt__msg">
        {message}
      </p>
      <FormAlert message={error} />
      <ul className="kz-attempts">
        {items.map((a) => {
          const s = attemptStatus(a.status);
          return (
            <li key={a.id} className="kz-attempt">
              <div className="kz-attempt__top">
                <span>
                  {a.methodLabel}
                  {a.payerPhoneMasked ? <span className="kz-attempt__mute"> · {a.payerPhoneMasked}</span> : null}
                </span>
                <span className="kz-amono">{a.amount}</span>
              </div>
              <div className="kz-attempt__tags">
                <StatusPill tone={s.tone}>{s.label}</StatusPill>
                {a.testMode ? <StatusPill tone="warn">Test</StatusPill> : null}
                {a.paymentId ? <a href={`/admin/payments/${a.paymentId}`}>View payment</a> : null}
              </div>
              <p className="kz-attempt__mute">
                Started {formatWhen(a.createdAt)}
                {a.accountLabel ? ` · ${a.accountLabel}` : ''} · <span className="kz-amono">{a.merchantReference}</span>
              </p>
              <p className="kz-attempt__mute">
                {a.checkCount === 0
                  ? 'Not checked with the gateway yet'
                  : `Checked ${a.checkCount} ${a.checkCount === 1 ? 'time' : 'times'}, last ${formatWhen(a.lastCheckedAt)}`}
                {a.nextCheckAt ? ` · next automatic check ${formatWhen(a.nextCheckAt)}` : ''}
              </p>
              {a.failureReason ? <p>{a.failureReason}</p> : null}
              {a.status !== 'created' ? (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId !== null}
                    aria-label={`Check now with the gateway: ${a.methodLabel} ${a.amount}, ${a.merchantReference}`}
                    onClick={() => void check(a)}
                  >
                    {busyId === a.id ? 'Checking…' : 'Check now'}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
