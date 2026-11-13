/**
 * Notifications behind the top-bar bell (logic of the P4.1 bell, extracted in R6.1): the unread count from the server render, the
 * latest ten loaded when the panel opens, and "mark all read".
 */
import { useState } from 'react';
import { apiFetch } from '../lib/api';

export interface AdminNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** "just now", "5 min ago", "3 h ago", then the date. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Badge text; the accessible name carries the same text (WCAG 2.5.3). */
export const badge = (n: number) => (n > 99 ? '99+' : String(n));

export function useNotifications(initialUnread: number) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<AdminNotification[] | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<{ data: { items: AdminNotification[]; unread: number } }>(
        '/api/v1/admin/notifications?limit=10',
      );
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
  return { unread, items, error, load, markAll };
}
