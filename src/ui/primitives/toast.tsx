import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../icons/icon';
import { IconButton } from './button';

export type ToastKind = 'ok' | 'danger' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const Ctx = createContext<((kind: ToastKind, message: string) => void) | null>(null);

/**
 * Toasts: felt chips, bottom on phones and top-right on wider screens. Polite live region for ok/info, assertive for errors.
 * Auto-dismiss after 5 s (8 s for errors), paused while hovered or focused.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((xs) => xs.filter((t) => t.id !== id));
  }, []);
  const schedule = useCallback(
    (id: number, kind: ToastKind) =>
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), kind === 'danger' ? 8000 : 5000),
      ),
    [dismiss],
  );
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-2), { id, kind, message }]);
      schedule(id, kind);
    },
    [schedule],
  );
  const render = (t: ToastItem) => (
    <div
      key={t.id}
      className="kz-toast"
      onMouseEnter={() => clearTimeout(timers.current.get(t.id))}
      onMouseLeave={() => schedule(t.id, t.kind)}
      onFocus={() => clearTimeout(timers.current.get(t.id))}
      onBlur={() => schedule(t.id, t.kind)}
    >
      <Icon
        name={t.kind === 'ok' ? 'status-ok' : t.kind === 'danger' ? 'status-danger' : 'status-info'}
        className={`mt-0.5 kz-toast__icon--${t.kind}`}
      />
      <p className="flex-1 text-[0.9375rem] leading-snug">{t.message}</p>
      <IconButton
        name="close"
        label="Dismiss notification"
        size="sm"
        className="!text-white"
        onClick={() => dismiss(t.id)}
      />
    </div>
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="kz-toasts">
        <div role="status" aria-live="polite" className="grid gap-2">
          {items.filter((t) => t.kind !== 'danger').map(render)}
        </div>
        <div role="alert" aria-live="assertive" className="grid gap-2">
          {items.filter((t) => t.kind === 'danger').map(render)}
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  return useMemo(
    () => ({
      ok: (m: string) => push?.('ok', m),
      error: (m: string) => push?.('danger', m),
      info: (m: string) => push?.('info', m),
    }),
    [push],
  );
}
