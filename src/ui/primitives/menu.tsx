/**
 * Dropdown menu (R5.1): Radix supplies the behaviour (roles, roving focus, typeahead, Escape, outside click); the markup and styles
 * are ours (`kz-menu`). Items are links or actions; a danger item is set apart by a rule above it.
 */
import { DropdownMenu as R } from 'radix-ui';
import type { ReactNode } from 'react';
import { Icon } from '../icons/icon';
import type { IconName } from '../icons/registry';

export interface MenuEntry {
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: IconName;
  danger?: boolean;
}

export function Menu({
  trigger,
  items,
  align = 'end',
  label,
  header,
}: {
  trigger: ReactNode;
  items: MenuEntry[];
  align?: 'start' | 'end';
  /** Accessible name of the menu itself. */
  label?: string;
  /** Non-interactive heading at the top (e.g. who is signed in). */
  header?: ReactNode;
}) {
  return (
    <R.Root>
      <R.Trigger asChild>{trigger}</R.Trigger>
      <R.Portal>
        <R.Content align={align} sideOffset={8} className="kz-menu" aria-label={label}>
          {header ? <R.Label className="kz-menu__head">{header}</R.Label> : null}
          {items.map((item) => {
            const inner = (
              <>
                {item.icon ? <Icon name={item.icon} size={16} /> : null}
                <span>{item.label}</span>
              </>
            );
            return (
              <R.Item
                key={item.label}
                asChild={Boolean(item.href)}
                onSelect={item.onSelect}
                className={item.danger ? 'kz-menu__item is-danger' : 'kz-menu__item'}
              >
                {item.href ? <a href={item.href}>{inner}</a> : inner}
              </R.Item>
            );
          })}
        </R.Content>
      </R.Portal>
    </R.Root>
  );
}
