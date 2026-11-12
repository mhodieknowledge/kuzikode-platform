import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './button';
import { cx } from './cx';

/**
 * React modal on <dialog>: centred on tablet/desktop, a bottom sheet on phones (CSS). Focus trap, Escape and inert background come
 * from showModal(); the close animation runs before `close()`.
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'center',
  footer,
  children,
  className,
  describedBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: 'center' | 'bottom' | 'left' | 'top';
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  describedBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `s${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => (d.dataset.open = ''));
    } else if (!open && d.open) {
      delete d.dataset.open;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const t = setTimeout(() => d.close(), reduce ? 0 : 220);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);
  return (
    // Backdrop click closes; keyboard users close with Escape (onCancel) or the Close button.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={cx('kz-sheet', `kz-sheet--${side}`, className)}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="kz-sheet__panel">
        {side !== 'left' && side !== 'top' ? <div className="kz-sheet__grip sm:hidden" aria-hidden="true" /> : null}
        <div className="kz-sheet__head">
          <h2 id={titleId} className="kz-sheet__title">
            {title}
          </h2>
          <IconButton name="close" label="Close" onClick={onClose} />
        </div>
        <div className="kz-sheet__body">{children}</div>
        {footer ? <div className="kz-sheet__foot">{footer}</div> : null}
      </div>
    </dialog>
  );
}

/**
 * Confirmation for destructive or irreversible actions. With `confirmText`, the action stays disabled until that exact text is
 * typed (e.g. an invoice number). `onConfirm` may be async; the sheet shows progress and closes when it resolves.
 */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  confirmText,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = `c${useId().replace(/:/g, '')}`;
  const blocked = !!confirmText && typed.trim() !== confirmText;
  const close = () => {
    if (busy) return;
    setTyped('');
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <button
            type="button"
            className="kz-btn kz-btn--secondary flex-1 sm:flex-none"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cx('kz-btn flex-1 sm:ml-auto sm:flex-none', danger ? 'kz-btn--danger' : 'kz-btn--primary')}
            disabled={blocked || busy}
            aria-busy={busy || undefined}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setTyped('');
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <span className="kz-spinner" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children ? <div className="text-[var(--kz-fg-2)]">{children}</div> : null}
      {confirmText ? (
        <div className="kz-field mt-4">
          <label className="kz-label" htmlFor={inputId}>
            Type <strong className="font-mono">{confirmText}</strong> to confirm.
          </label>
          <input
            id={inputId}
            className="kz-input font-mono"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
      ) : null}
    </Sheet>
  );
}
