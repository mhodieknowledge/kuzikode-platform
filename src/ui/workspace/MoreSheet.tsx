/**
 * Phone "More" (R5.1): the fifth bottom-dock slot opens a bottom sheet with the destinations that did not fit in the dock, as
 * large rows (icon, label, chevron). The current page is marked.
 */
import { useState } from 'react';
import { Icon } from '../icons/icon';
import { Sheet } from '../primitives';
import type { WorkspaceItem } from './nav';

export function MoreSheet({ items, active }: { items: WorkspaceItem[]; active?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const current = items.some((i) => i.key === active);
  return (
    <>
      <button
        type="button"
        className="kz-bdock__item"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-on={current ? '' : undefined}
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={20} />
        <span>More</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="More" side="bottom">
        <ul className="kz-more">
          {items.map((i) => (
            <li key={i.key}>
              <a href={i.href} aria-current={i.key === active ? 'page' : undefined}>
                <Icon name={i.icon} size={20} />
                <span>{i.label}</span>
                <Icon name="chevron-right" size={16} />
              </a>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
