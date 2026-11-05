import { Dialog as RDialog } from 'radix-ui';
import { X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { cn } from './cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/** Accessible modal (focus trap + restore, Esc to close) built on Radix. */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink-950/40 data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <RDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-line bg-surface p-6 shadow-2 focus:outline-none',
            { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size],
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="font-sans text-lg font-semibold text-ink-950">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-sm text-ink-600">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="-mt-1 -mr-2 rounded-sm p-2 text-ink-600 hover:bg-ink-950/5" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </RDialog.Close>
          </div>
          {children}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  /** For void/delete: the user must type this text (e.g. the document number) to enable the button. */
  confirmText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  confirmText,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const blocked = !!confirmText && typed.trim() !== confirmText;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped('');
        onOpenChange(o);
      }}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={busy}
            disabled={blocked}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setTyped('');
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {confirmText ? (
        <div className="flex flex-col gap-1.5 text-sm text-ink-800">
          <label htmlFor={inputId}>
            Type <strong className="font-mono">{confirmText}</strong> to confirm.
          </label>
          <Input id={inputId} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      ) : null}
    </Dialog>
  );
}

/** Side panel for secondary forms and details. */
export function Drawer({ open, onOpenChange, title, children, footer }: Omit<DialogProps, 'size'>) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink-950/40" />
        <RDialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-2 focus:outline-none">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <RDialog.Title className="font-sans text-lg font-semibold text-ink-950">{title}</RDialog.Title>
            <RDialog.Description className="sr-only">{title}</RDialog.Description>
            <RDialog.Close className="rounded-sm p-2 text-ink-600 hover:bg-ink-950/5" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </RDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
