import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { decimalStringToMinor, minorToDecimalString } from '../../shared/money';
import { cx } from './cx';

export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  valueMinor: number | null;
  onChangeMinor: (minor: number | null) => void;
  currency: string;
  minorDigits?: number;
  /** Reports a parse problem ("Use at most 2 decimal places") for the surrounding Field. */
  onParseError?: (message: string | null) => void;
}

/**
 * Currency-aware amount input: text → integer minor units through src/shared/money.ts (never floats). The currency code sits in
 * the field as a mono prefix; digits are tabular and right-aligned.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { valueMinor, onChangeMinor, currency, minorDigits = 2, onParseError, className, ...rest },
  ref,
) {
  const [text, setText] = useState(valueMinor === null ? '' : minorToDecimalString(valueMinor, minorDigits));
  useEffect(() => {
    setText((t) => {
      try {
        if (t !== '' && decimalStringToMinor(t, minorDigits) === valueMinor) return t;
      } catch {
        /* keep the user's text while it doesn't parse */
      }
      return valueMinor === null ? '' : minorToDecimalString(valueMinor, minorDigits);
    });
  }, [valueMinor, minorDigits]);
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-[0.8125rem] text-[var(--ink-600)]"
        aria-hidden="true"
      >
        {currency}
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cx('kz-input pl-14 text-right font-mono tabular-nums', className)}
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t.trim() === '') {
            onParseError?.(null);
            onChangeMinor(null);
            return;
          }
          try {
            const minor = decimalStringToMinor(t, minorDigits);
            if (minor < 0) throw new Error('Amount cannot be negative');
            onParseError?.(null);
            onChangeMinor(minor);
          } catch (err) {
            onParseError?.(err instanceof Error ? err.message : 'Invalid amount');
          }
        }}
        onBlur={() => {
          if (valueMinor !== null) setText(minorToDecimalString(valueMinor, minorDigits));
        }}
        {...rest}
      />
    </div>
  );
});
