import { Icon } from '../../icons/icon';
import { Button } from '../../primitives';
import { useOtp, type StartView } from './useCheckout';

/** One-time code from the SMS: six mono boxes (16 px+ text, ≥ 44 px wide), auto-advance, paste fills all and submits. */
export function OtpBoxes({ url, onDone }: { url: string; onDone: (d: StartView) => void }) {
  const otp = useOtp(url, onDone);
  return (
    <form
      className="kz-cootp"
      onSubmit={(e) => {
        e.preventDefault();
        otp.submitAll();
      }}
    >
      <fieldset className="kz-cootp__set">
        <legend className="kz-label">One-time code from the SMS</legend>
        <div className="kz-cootp__boxes">
          {otp.digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                otp.boxes.current[i] = el;
              }}
              value={d}
              onChange={(e) => otp.set(i, e.target.value)}
              onKeyDown={(e) => otp.onKey(i, e)}
              onPaste={otp.onPaste}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              aria-label={`Digit ${i + 1} of ${otp.length}`}
              aria-invalid={otp.error ? true : undefined}
              disabled={otp.busy}
              className="kz-cootp__box"
            />
          ))}
        </div>
      </fieldset>
      {otp.error ? (
        <p role="alert" className="kz-error">
          <Icon name="status-danger" size={16} className="mt-0.5" />
          {otp.error}
        </p>
      ) : null}
      <Button type="submit" variant="solid" loading={otp.busy} disabled={!otp.complete} className="kz-cootp__go">
        Confirm code
      </Button>
    </form>
  );
}
