/**
 * Admin command palette (R6.1, PANEL_DESIGN_SPEC §1/§3): the top-bar search field, ⌘K / Ctrl K, opens a modal <dialog> with a
 * combobox over one listbox: server matches (clients, invoices, quotations, projects, from two characters) first, then the
 * modules this staff member may open. ↑/↓ move, Enter opens, Escape closes. The dialog is only mounted while open, so its
 * search field never competes with a page's own "Search" field. Shares the workspace palette's surface (`kz-pal`).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../icons/icon';
import type { IconName } from '../icons/registry';
import type { AdminShortcut } from './nav';
import { SEARCH_KIND, useAdminSearch, type AdminSearchResult } from './useAdminSearch';

const KIND_ICON: Record<AdminSearchResult['kind'], IconName> = {
  client: 'clients',
  invoice: 'invoices',
  quotation: 'quotations',
  project: 'projects',
};

interface Option {
  key: string;
  label: string;
  meta: string;
  href: string;
  icon: IconName;
}

export function AdminPalette({ shortcuts }: { shortcuts: AdminShortcut[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button type="button" className="kz-afind" onClick={() => setOpen(true)}>
        <Icon name="search" size={16} />
        <span className="kz-afind__t">Search</span>
        <span className="kz-afind__hint" aria-hidden="true">
          clients, invoices, numbers…
        </span>
        <kbd aria-hidden="true">⌘K</kbd>
      </button>
      {open ? <PaletteDialog shortcuts={shortcuts} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PaletteDialog({ shortcuts, onClose }: { shortcuts: AdminShortcut[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const uid = useId().replace(/:/g, '');
  const listId = `apal-${uid}`;
  const { results, loading, searching } = useAdminSearch(q);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    requestAnimationFrame(() => input.current?.focus());
  }, []);
  // New results move the highlight back to the first option (adjusted during render, not in an effect).
  const [seen, setSeen] = useState(results);
  if (seen !== results) {
    setSeen(results);
    setActive(0);
  }

  const term = q.trim().toLowerCase();
  const options = useMemo<Option[]>(
    () => [
      ...results.map((r) => ({
        key: `${r.kind}:${r.id}`,
        label: r.title,
        meta: `${SEARCH_KIND[r.kind]} · ${r.subtitle}`,
        href: r.href,
        icon: KIND_ICON[r.kind],
      })),
      ...shortcuts
        .filter((s) => !term || s.label.toLowerCase().includes(term))
        .map((s) => ({ key: `go:${s.href}`, label: s.label, meta: `Go to · ${s.group}`, href: s.href, icon: s.icon })),
    ],
    [results, shortcuts, term],
  );
  const go = (o: Option | undefined) => {
    if (o) window.location.assign(o.href);
  };

  return (
    // Backdrop click closes; keyboard users close with Escape.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="kz-pal kz-pal--admin"
      aria-label="Search"
      aria-describedby={`${listId}-hint`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="kz-pal__panel">
        <div className="kz-pal__field">
          <Icon name="search" size={20} />
          <input
            ref={input}
            role="combobox"
            maxLength={80}
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
            aria-label="Search"
            placeholder="Client, invoice or quotation number, project…"
            value={q}
            onChange={(e) => {
              setQ(e.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(options[active]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <kbd className="kz-pal__esc" aria-hidden="true">
            Esc
          </kbd>
        </div>
        <p id={`${listId}-hint`} className="sr-only">
          Clients, invoices, quotations and projects by number or name.
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {loading ? 'Searching' : searching ? `${results.length} results` : ''}
        </p>
        <ul id={listId} role="listbox" aria-label="Results" className="kz-pal__list">
          {options.map((o, i) => (
            // Options are chosen with the keyboard from the combobox; the click handler serves pointers.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="kz-pal__opt"
              onMouseMove={() => setActive(i)}
              onClick={() => go(o)}
            >
              <Icon name={o.icon} size={20} />
              <span className="kz-pal__label">{o.label}</span>
              <span className="kz-pal__group">{o.meta}</span>
            </li>
          ))}
          {searching && !loading && options.length === 0 ? (
            <li className="kz-pal__none" role="presentation">
              Nothing found for “{q.trim()}”.
            </li>
          ) : null}
        </ul>
        <p className="kz-pal__foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </p>
      </div>
    </dialog>
  );
}
