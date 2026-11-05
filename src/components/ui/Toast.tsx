import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<((kind: ToastKind, message: string) => void) | null>(null);

/** Toasts announced through aria-live regions (polite for success/info, assertive for errors). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 5000);
    },
    [dismiss],
  );
  const icon = { success: CheckCircle2, error: XCircle, info: Info };
  const render = (t: ToastItem) => {
    const Icon = icon[t.kind];
    return (
      <div
        key={t.id}
        className="pointer-events-auto flex items-start gap-3 rounded-sm border border-line bg-surface p-3 pr-2 shadow-2"
      >
        <Icon
          size={18}
          aria-hidden="true"
          className={cn(
            'mt-0.5 shrink-0',
            t.kind === 'success' ? 'text-success-600' : t.kind === 'error' ? 'text-danger-600' : 'text-info-600',
          )}
        />
        <p className="flex-1 text-sm text-ink-950">{t.message}</p>
        <button
          type="button"
          onClick={() => dismiss(t.id)}
          className="rounded-sm p-1 text-ink-600 hover:bg-ink-950/5"
          aria-label="Dismiss notification"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100%-2rem))] flex-col gap-2">
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {items.filter((t) => t.kind !== 'error').map(render)}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {items.filter((t) => t.kind === 'error').map(render)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return useMemo(
    () => ({
      success: (m: string) => push?.('success', m),
      error: (m: string) => push?.('error', m),
      info: (m: string) => push?.('info', m),
    }),
    [push],
  );
}
