/**
 * Account menu at the right of the admin top bar (R6.1): an initials plate (name and email beside it from 1024 px), then a header with
 * the name and email, security, signed-in devices, notification preferences and sign out. Behaviour from the shared Menu primitive (Radix).
 */
import { Icon } from '../icons/icon';
import { Menu } from '../primitives';
import { initials, signOutAdmin } from './account';

export function AdminUserMenu({ name, email }: { name: string; email: string }) {
  return (
    <Menu
      label="Account"
      header={
        <>
          <span className="kz-menu__head-name">{name}</span>
          <span className="kz-menu__head-mail">{email}</span>
        </>
      }
      trigger={
        <button type="button" className="kz-aacct">
          <span className="sr-only">Account menu: </span>
          <span className="kz-aacct__plate" aria-hidden="true">
            {initials(name) || '·'}
          </span>
          <span className="kz-aacct__text">
            <span className="kz-aacct__name">{name}</span>
            <span className="kz-aacct__mail">{email}</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      }
      items={[
        { label: 'Security & password', href: '/admin/account/security', icon: 'lock' },
        { label: 'Signed-in devices', href: '/admin/account/sessions', icon: 'key' },
        { label: 'Notification preferences', href: '/admin/account/notifications', icon: 'notifications' },
        { label: 'Sign out', onSelect: () => void signOutAdmin(), icon: 'sign-out', danger: true },
      ]}
    />
  );
}
