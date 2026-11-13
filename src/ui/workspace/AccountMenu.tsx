/**
 * The account menu in the workspace status bar (R5.1): initials plate + name, then account, devices, the light/dark theme switch
 * (R5.4) and sign out.
 */
import { apiFetch } from '../lib/api';
import { Icon } from '../icons/icon';
import { Menu } from '../primitives';
import { useTheme, type WorkspaceTheme } from './theme';

export function AccountMenu({
  name,
  email,
  theme: initialTheme = 'light',
}: {
  name: string;
  email: string;
  theme?: WorkspaceTheme;
}) {
  const { theme, toggle } = useTheme(initialTheme);
  async function signOut() {
    await apiFetch('/api/v1/auth/portal/logout', { method: 'POST', body: {} }).catch(() => undefined);
    window.location.assign('/portal/login');
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return (
    <Menu
      label="Account"
      trigger={
        <button type="button" className="kz-wsacct">
          <span className="sr-only">Account menu: </span>
          <span className="kz-wsacct__plate" aria-hidden="true">
            {initials || '·'}
          </span>
          <span className="kz-wsacct__text">
            <span className="kz-wsacct__name">{name}</span>
            <span className="kz-wsacct__mail">{email}</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      }
      items={[
        { label: 'Your account', href: '/portal/account', icon: 'account' },
        { label: 'Signed-in devices', href: '/portal/account/sessions', icon: 'key' },
        theme === 'dark'
          ? { label: 'Light theme', onSelect: toggle, icon: 'theme-light' }
          : { label: 'Dark theme', onSelect: toggle, icon: 'theme-dark' },
        { label: 'Sign out', onSelect: () => void signOut(), icon: 'sign-out', danger: true },
      ]}
    />
  );
}
