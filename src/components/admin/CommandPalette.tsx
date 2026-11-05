import { Search } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { apiFetch, Dialog } from '../ui';

interface Result {
  kind: 'client' | 'invoice' | 'quotation' | 'project';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
interface Shortcut {
  label: string;
  href: string;
}

const KIND: Record<Result['kind'], string> = {
  client: 'Client',
  invoice: 'Invoice',
  quotation: 'Quotation',
  project: 'Project',
};

/** ⌘K / Ctrl+K global search over clients, invoices, quotations and projects (P4.1), plus quick links. */
export default function CommandPalette({ shortcuts }: { shortcuts: Shortcut[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Put the cursor in the search box when the palette opens (after Radix moves focus into the dialog).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => input.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      apiFetch<{ data: Result[] }>(`/api/v1/admin/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => {
          setResults(r.data);
          setActive(0);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  const term = q.trim().toLowerCase();
  const links = shortcuts.filter((s) => !term || s.label.toLowerCase().includes(term));
  const items: { key: string; label: string; meta: string; href: string }[] = [
    ...(term.length >= 2 ? results : []).map((r) => ({
      key: `${r.kind}:${r.id}`,
      label: r.title,
      meta: `${KIND[r.kind]} · ${r.subtitle}`,
      href: r.href,
    })),
    ...links.map((s) => ({ key: `go:${s.href}`, label: s.label, meta: 'Go to', href: s.href })),
  ];

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      window.location.assign(items[active].href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-sm items-center gap-2 rounded-sm border border-line bg-canvas px-3 text-sm text-ink-600 hover:border-ink-400"
      >
        <Search size={16} aria-hidden="true" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded-[4px] border border-line bg-surface px-1.5 font-sans text-[11px] text-ink-600 sm:inline">
          ⌘K
        </kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQ('');
        }}
        title="Search"
        description="Clients, invoices, quotations and projects by number or name."
        size="lg"
      >
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={80}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="palette-results"
          aria-activedescendant={items[active] ? `palette-${active}` : undefined}
          aria-label="Search"
          placeholder="Type a name or number…"
          className="h-11 w-full rounded-sm border border-line px-3 text-[15px] text-ink-950 focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-500"
        />
        <p className="sr-only" role="status" aria-live="polite">
          {loading ? 'Searching' : term.length >= 2 ? `${results.length} results` : ''}
        </p>
        <ul id="palette-results" role="listbox" aria-label="Results" className="mt-3 max-h-80 overflow-y-auto">
          {items.map((it, i) => (
            <li key={it.key} id={`palette-${i}`} role="option" aria-selected={i === active}>
              <a
                href={it.href}
                onMouseEnter={() => setActive(i)}
                className={`flex flex-col rounded-sm px-3 py-2 ${i === active ? 'bg-brand-50' : ''}`}
              >
                <span className="text-sm font-semibold text-ink-950">{it.label}</span>
                <span className="text-[12px] text-ink-600">{it.meta}</span>
              </a>
            </li>
          ))}
          {term.length >= 2 && !loading && items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-600">Nothing found for “{q.trim()}”.</li>
          ) : null}
        </ul>
      </Dialog>
    </>
  );
}
