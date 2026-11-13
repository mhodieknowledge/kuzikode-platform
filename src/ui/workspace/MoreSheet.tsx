/**
 * Phone "More" (R5.1): the fifth bottom-dock slot opens a bottom sheet with the destinations that did not fit in the dock, as
 * large rows (icon, label, chevron). The current page is marked. The last row switches the light/dark theme (R5.4).
 */
import { useState } from 'react';
import { Icon } from '../icons/icon';
import { Sheet } from '../primitives';
import type { WorkspaceItem } from './nav';
import { useTheme, type WorkspaceTheme } from './theme';

export function MoreSheet({
  items,
  active,
  theme: initialTheme = 'light',
}: {
  items: WorkspaceItem[];
  active?: string | undefined;
  theme?: WorkspaceTheme;
}) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme(initialTheme);
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
          <li>
            <button type="button" aria-pressed={theme === 'dark'} onClick={toggle}>
              <Icon name={theme === 'dark' ? 'theme-light' : 'theme-dark'} size={20} />
              <span>Dark theme</span>
              <span className="kz-more__state">{theme === 'dark' ? 'On' : 'Off'}</span>
            </button>
          </li>
        </ul>
      </Sheet>
    </>
  );
}
