import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from '../icons/icon';
import { cx } from './cx';

interface FieldShell {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  className?: string;
}

/**
 * Label + control + hint + error, wired with ids (aria-describedby, aria-invalid). The control is passed as a render function so
 * any input type can be used: `<Field label="Email">{(p) => <input {...p} className="kz-input" />}</Field>`.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  id: givenId,
  children,
}: FieldShell & {
  id?: string;
  children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
}) {
  const auto = useId();
  const id = givenId ?? `f${auto.replace(/:/g, '')}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('kz-field', className)}>
      <label className="kz-label" htmlFor={id}>
        {label}
        {optional ? <span className="kz-label__opt"> (optional)</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, ...(error ? { 'aria-invalid': true as const } : {}) })}
      {hint ? (
        <p className="kz-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="kz-error" id={errId}>
          <Icon name="status-danger" size={16} className="mt-0.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = FieldShell & InputHTMLAttributes<HTMLInputElement>;
export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, optional, className, id, ...input },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className} id={id}>
      {(p) => <input ref={ref} {...p} {...input} className="kz-input" />}
    </Field>
  );
});

type SelectProps = FieldShell & SelectHTMLAttributes<HTMLSelectElement>;
export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, hint, error, optional, className, id, children, ...select },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className} id={id}>
      {(p) => (
        <select ref={ref} {...p} {...select} className="kz-input">
          {children}
        </select>
      )}
    </Field>
  );
});

type TextareaProps = FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>;
export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextareaField(
  { label, hint, error, optional, className, id, ...area },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className} id={id}>
      {(p) => <textarea ref={ref} {...p} {...area} className="kz-input" />}
    </Field>
  );
});

/** Consent-style checkbox row. */
export function CheckRow({
  children,
  className,
  ...input
}: { children: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('kz-check', className)}>
      <input type="checkbox" {...input} />
      <span>{children}</span>
    </label>
  );
}

export interface ChoiceOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
}

/** Radio or checkbox group as large tiles; the selected tile inverts to felt. */
export function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
  multiple = false,
  error,
  columns = 1,
  className,
}: {
  legend: ReactNode;
  name: string;
  options: ChoiceOption[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multiple?: boolean;
  error?: string | undefined;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const auto = useId();
  const errId = error ? `cg${auto.replace(/:/g, '')}-error` : undefined;
  const selected = new Set(Array.isArray(value) ? value : [value]);
  const toggle = (v: string) => {
    if (!multiple) return onChange(v);
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  };
  return (
    <fieldset className={cx('kz-field', className)} aria-describedby={errId}>
      <legend className="kz-label mb-2">{legend}</legend>
      <div
        className={cx(
          'grid gap-2',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {options.map((o) => (
          <label key={o.value} className={cx('kz-choice', !multiple && 'kz-choice--radio')}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={name}
              value={o.value}
              checked={selected.has(o.value)}
              onChange={() => toggle(o.value)}
            />
            <span className="kz-choice__mark" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <span className="kz-choice__text">
              <span className="font-semibold">{o.label}</span>
              {o.hint ? <span className="kz-choice__hint">{o.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="kz-error" id={errId}>
          <Icon name="status-danger" size={16} className="mt-0.5" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
