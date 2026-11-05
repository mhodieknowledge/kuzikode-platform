import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Input } from './Input';

/** Search box that reports changes after the user pauses typing. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
  delay = 300,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  delay?: number;
}) {
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    // Sync with a value changed from outside (e.g. filters reset) without an effect.
    setPrev(value);
    setLocal(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="relative w-full sm:w-72">
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={local}
        className="pr-8 pl-9"
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(v), delay);
        }}
      />
      {local ? (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-ink-400 hover:text-ink-950"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div role="search" className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
