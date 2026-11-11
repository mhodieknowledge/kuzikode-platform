import { Bell } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { apiFetch } from '../ui';

interface Item {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** Bell with unread count; opens the latest notifications and marks them read (P4.1). */
export default function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<{ data: { items: Item[]; unread: number } }>('/api/v1/admin/notifications?limit=10');
      setItems(res.data.items);
      setUnread(res.data.unread);
      setError(false);
    } catch {
      setError(true);
    }
  }
  async function markAll() {
    await apiFetch('/api/v1/admin/notifications/read', { body: { ids: [] } }).catch(() => undefined);
    setUnread(0);
    setItems((list) => list?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? null);
  }

  return (
    <Popover.Root onOpenChange={(o) => o && void load()}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-800 hover:bg-ink-950/5"
          // The visible badge text must be part of the name (WCAG 2.5.3): "99+" above 99.
          aria-label={unread ? `Notifications, ${unread > 99 ? '99+' : unread} unread` : 'Notifications'}
        >
          <Bell size={18} aria-hidden="true" />
          {unread ? (
            <span
              className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-danger-600 px-1 text-center text-[10px] leading-4 font-semibold text-white"
              aria-hidden="true"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-md border border-line bg-surface shadow-2"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink-950">Notifications</p>
            {unread ? (
              <button type="button" onClick={() => void markAll()} className="text-[13px] font-semibold text-brand-600">
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {error ? <li className="px-4 py-6 text-sm text-ink-600">Could not load notifications.</li> : null}
            {items && items.length === 0 ? (
              <li className="px-4 py-6 text-sm text-ink-600">You are all caught up.</li>
            ) : null}
            {items?.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <a href={n.link ?? '/admin/notifications'} className="flex gap-3 px-4 py-3 hover:bg-canvas">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-brand-600'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-950">
                      {n.title}
                      {n.readAt ? null : <span className="sr-only"> (unread)</span>}
                    </span>
                    {n.body ? <span className="block truncate text-[13px] text-ink-600">{n.body}</span> : null}
                    <span className="block text-[12px] text-ink-600">{ago(n.createdAt)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <a
            href="/admin/notifications"
            className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-brand-600"
          >
            See all notifications
          </a>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
