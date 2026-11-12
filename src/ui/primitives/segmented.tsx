import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * React segmented control (radio-group semantics). The solid thumb slides to the selected option; arrow keys move selection.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  block = false,
  className,
}: {
  label: string;
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  block?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const active = el.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!active) return setThumb(null);
      setThumb({ x: active.offsetLeft, w: active.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options.length]);
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length]!;
    onChange(next.value);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };
  return (
    // Focus lives on the checked radio (roving tabindex), as the radiogroup pattern prescribes.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      ref={box}
      role="radiogroup"
      aria-label={label}
      className={cx('kz-seg', block && 'kz-seg--block', className)}
      data-ready={thumb ? '' : undefined}
      onKeyDown={onKey}
    >
      <span
        className="kz-seg__thumb"
        aria-hidden="true"
        style={thumb ? { width: thumb.w, transform: `translateX(${thumb.x}px)` } : undefined}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className="kz-seg__opt"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
