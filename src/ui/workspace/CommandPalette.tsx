/**
 * Workspace command palette (R5.1, PANEL_DESIGN_SPEC §1): ⌘K / Ctrl K or the status-bar button opens a modal <dialog> with a
 * combobox over a listbox of destinations and actions (the same list as the dock, plus a few account actions). Type to filter,
 * ↑/↓ to move, Enter to go, Escape to close. No server search: every entry is a real page the client can open.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../icons/icon';
import type { IconName } from '../icons/registry';

export interface PaletteEntry {
  label: string;
  href: string;
  icon: IconName;
  group: 'Go to' | 'Actions';
  /** Extra words that should match (e.g. "bill" for invoices). */
  keywords?: string;
}

export function CommandPalette({ entries }: { entries: PaletteEntry[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const uid = useId().replace(/:/g, '');
  const listId = `pal-${uid}`;

  const shown = useMemo(() => {
    const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return entries.filter((e) => {
      const hay = `${e.label} ${e.keywords ?? ''} ${e.group}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [entries, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('kz:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('kz:palette', onOpen);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ('');
      setActive(0);
      d.showModal();
      requestAnimationFrame(() => input.current?.focus());
    } else if (!open && d.open) d.close();
  }, [open]);

  const go = (e: PaletteEntry | undefined) => {
    if (e) window.location.assign(e.href);
  };

  return (
    // Backdrop click closes; keyboard users close with Escape.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="kz-pal"
      aria-label="Search the workspace"
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="kz-pal__panel">
        <div className="kz-pal__field">
          <Icon name="search" size={20} />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            aria-label="Search the workspace"
            placeholder="Jump to a page or action"
            value={q}
            onChange={(e) => {
              setQ(e.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(shown[active]);
              }
            }}
          />
          <kbd className="kz-pal__esc">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="kz-pal__list">
          {shown.length === 0 ? (
            <li className="kz-pal__none" role="presentation">
              Nothing matches “{q}”.
            </li>
          ) : (
            shown.map((e, i) => (
              // Options are chosen with the keyboard from the combobox; the click handler serves pointers.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={e.href + e.label}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="kz-pal__opt"
                onMouseMove={() => setActive(i)}
                onClick={() => go(e)}
              >
                <Icon name={e.icon} size={20} />
                <span className="kz-pal__label">{e.label}</span>
                <span className="kz-pal__group">{e.group}</span>
              </li>
            ))
          )}
        </ul>
        <p className="kz-pal__foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
        </p>
      </div>
    </dialog>
  );
}
