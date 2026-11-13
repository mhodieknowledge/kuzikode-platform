/**
 * Admin edit-form building blocks (R6.2, PANEL_DESIGN_SPEC §3 "forms single column with sticky save bar"):
 * - `FormSection`: a paper section; from 1024 px its title and description sit in a 220 px column beside the fields
 *   (settings-style), below that they stack. `cols={2}` lays fields in two columns from 768 px (`kz-span-2` spans both).
 * - `SaveBar`: sticky at the bottom of the content area, carrying the form-level message and the save / cancel actions, so
 *   the primary action is always in reach on phones.
 * - `CheckItem`: a compact native checkbox row (44 px on touch).
 */
import type { InputHTMLAttributes, ReactNode } from 'react';
import { FormAlert } from '../auth/FormAlert';
import { cx } from '../primitives/cx';
import { Button } from '../primitives/button';
import { Sheet } from '../primitives/sheet';

export function FormSection({
  id,
  title,
  description,
  cols = 2,
  wide = false,
  action,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  cols?: 1 | 2;
  /** Full-width body (the head sits above it at every size), e.g. the line-item editor. */
  wide?: boolean;
  /** A control in the head row (wide sections), e.g. "Add package". */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('kz-afsec', wide && 'kz-afsec--wide', className)} aria-labelledby={id}>
      <div className={cx('kz-afsec__head', action ? 'kz-afsec__head--row' : undefined)}>
        <div>
          <h2 id={id} className="kz-afsec__title">
            {title}
          </h2>
          {description ? <p className="kz-afsec__desc">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={cx('kz-afsec__body', cols === 2 && 'kz-afsec__body--2')}>{children}</div>
    </section>
  );
}

export function SaveBar({
  error,
  hint,
  children,
}: {
  error?: string | null | undefined;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="kz-asave">
      <div className="kz-asave__in">
        <div className="kz-asave__msg">
          {error ? <FormAlert message={error} /> : hint ? <p className="kz-asave__hint">{hint}</p> : null}
        </div>
        <div className="kz-asave__btns">{children}</div>
      </div>
    </div>
  );
}

export function CheckItem({
  children,
  className,
  ...input
}: { children: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('kz-acheck', className)}>
      <input type="checkbox" {...input} />
      <span>{children}</span>
    </label>
  );
}

/**
 * A dialog with one form: title, body (the fields), the form-level error and a Cancel / submit footer (the submit button
 * belongs to the form by id, so Enter submits). Used by every admin action that asks for input (pay, void, cancel…).
 */
export function FormSheet({
  open,
  onClose,
  title,
  formId,
  submitLabel,
  onSubmit,
  busy = false,
  error,
  danger = false,
  disabled = false,
  cancelLabel = 'Cancel',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  formId: string;
  submitLabel: string;
  onSubmit: (form: FormData) => void;
  busy?: boolean;
  error?: string | null | undefined;
  danger?: boolean;
  disabled?: boolean;
  cancelLabel?: string;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      className="kz-adlg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            disabled={disabled}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="kz-astack"
        onSubmit={(ev) => {
          ev.preventDefault();
          onSubmit(new FormData(ev.currentTarget));
        }}
      >
        {children}
        <FormAlert message={error ?? null} />
      </form>
    </Sheet>
  );
}
