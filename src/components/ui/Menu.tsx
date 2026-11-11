import { DropdownMenu as RMenu, Tabs as RTabs, Tooltip as RTooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownMenu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
}) {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-44 rounded-sm border border-line bg-surface p-1 shadow-2"
        >
          {items.map((item) =>
            item.href ? (
              <RMenu.Item key={item.label} asChild disabled={item.disabled ?? false}>
                <a
                  href={item.href}
                  className="block rounded-[4px] px-3 py-2 text-sm text-ink-800 outline-none data-[highlighted]:bg-canvas"
                >
                  {item.label}
                </a>
              </RMenu.Item>
            ) : (
              <RMenu.Item
                key={item.label}
                disabled={item.disabled ?? false}
                onSelect={() => item.onSelect?.()}
                className={cn(
                  'cursor-default rounded-[4px] px-3 py-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-canvas',
                  item.danger ? 'text-danger-600' : 'text-ink-800',
                )}
              >
                {item.label}
              </RMenu.Item>
            ),
          )}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

export function Tabs({
  tabs,
  value,
  onValueChange,
  label,
}: {
  tabs: { value: string; label: string; content: ReactNode }[];
  value: string;
  onValueChange: (v: string) => void;
  label: string;
}) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange}>
      <RTabs.List aria-label={label} className="flex gap-1 relative overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className="-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap text-ink-600 hover:text-ink-950 data-[state=active]:border-brand-600 data-[state=active]:text-ink-950"
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="pt-5 focus-visible:outline-none">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={300}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content
            sideOffset={6}
            className="z-50 max-w-64 rounded-sm bg-ink-950 px-2.5 py-1.5 text-xs text-white shadow-2"
          >
            {content}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}
