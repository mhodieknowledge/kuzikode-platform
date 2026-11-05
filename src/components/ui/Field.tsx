import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from './cn';

export interface FieldProps {
  label: string;
  /** The control. It receives id, aria-describedby and aria-invalid automatically. */
  children: ReactElement<Record<string, unknown>>;
  hint?: ReactNode;
  error?: string | string[] | undefined;
  required?: boolean;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
}

/** Label + control + hint + error, wired with aria-describedby (docs/05 §6). */
export function Field({ label, children, hint, error, required, hideLabel, className }: FieldProps) {
  const id = useId();
  const controlId = (isValidElement(children) && (children.props['id'] as string | undefined)) || `f${id}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errors = (Array.isArray(error) ? error : error ? [error] : []).filter(Boolean);
  const errorId = errors.length ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className={cn('text-sm font-medium text-ink-950', hideLabel && 'sr-only')}>
        {label}
        {required ? (
          <span className="ml-0.5 text-danger-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': errors.length ? true : undefined,
        required: required || undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-[13px] text-ink-600">
          {hint}
        </p>
      ) : null}
      {errors.length ? (
        <p id={errorId} className="text-[13px] font-medium text-danger-600">
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  );
}
