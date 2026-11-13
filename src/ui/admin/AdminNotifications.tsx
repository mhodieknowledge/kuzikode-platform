/**
 * Top-bar bell (R6.1): the unread count as a small plate on the bell (its text is part of the button's name), and a panel with
 * the latest ten notifications that loads when opened, a "Mark all read" action and a link to the full list. Radix Popover
 * supplies focus handling, Escape and outside click; the markup is ours.
 */
import { Popover } from 'radix-ui';
import { Icon } from '../icons/icon';
import { ago, badge, useNotifications } from './useNotifications';

export function AdminNotifications({ initialUnread }: { initialUnread: number }) {
  const { unread, items, error, load, markAll } = useNotifications(initialUnread);
  return (
    <Popover.Root onOpenChange={(o) => o && void load()}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="kz-abtn kz-abell"
          aria-label={unread ? `Notifications, ${badge(unread)} unread` : 'Notifications'}
        >
          <Icon name="notifications" size={20} />
          {unread ? (
            <span className="kz-abell__n" aria-hidden="true">
              {badge(unread)}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={8} className="kz-anote">
          <div className="kz-anote__head">
            <p className="kz-anote__title">Notifications</p>
            {unread ? (
              <button type="button" className="kz-anote__mark" onClick={() => void markAll()}>
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="kz-anote__list">
            {error ? <li className="kz-anote__empty">Could not load notifications.</li> : null}
            {!items && !error ? <li className="kz-anote__empty">Loading…</li> : null}
            {items && items.length === 0 ? <li className="kz-anote__empty">You are all caught up.</li> : null}
            {items?.map((n) => (
              <li key={n.id}>
                <a
                  href={n.link ?? '/admin/notifications'}
                  className="kz-anote__row"
                  data-unread={n.readAt ? undefined : ''}
                >
                  <span className="kz-anote__dot" aria-hidden="true" />
                  <span className="kz-anote__text">
                    <span className="kz-anote__t">
                      {n.title}
                      {n.readAt ? null : <span className="sr-only"> (unread)</span>}
                    </span>
                    {n.body ? <span className="kz-anote__b">{n.body}</span> : null}
                  </span>
                  <span className="kz-anote__ago">{ago(n.createdAt)}</span>
                </a>
              </li>
            ))}
          </ul>
          <a href="/admin/notifications" className="kz-anote__all">
            See all notifications
            <Icon name="arrow-right" size={16} />
          </a>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
