import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { decimalStringToMinor, minorToDecimalString } from '../../shared/money';
import { cn } from './cn';
import { controlClasses } from './Input';

export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  valueMinor: number | null;
  onChangeMinor: (minor: number | null) => void;
  currency: string;
  minorDigits?: number;
  /** Reports a parse problem ("Use at most 2 decimal places") for the surrounding Field. */
  onParseError?: (message: string | null) => void;
}

/** Currency-aware amount input. Parses text to integer minor units (never floats). */
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
        /* keep user's text */
      }
      return valueMinor === null ? '' : minorToDecimalString(valueMinor, minorDigits);
    });
  }, [valueMinor, minorDigits]);
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-xs text-ink-600"
        aria-hidden="true"
      >
        {currency}
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cn(controlClasses, 'tnum h-10 pl-12 text-right', className)}
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
