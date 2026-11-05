import { ChevronDown } from 'lucide-react';
import { apiFetch, DropdownMenu } from '../ui';

/** Account menu in the admin top bar: security, sessions, sign out (P4.1). */
export default function UserMenu({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  async function signOut() {
    await apiFetch('/api/v1/auth/admin/logout', { method: 'POST', body: {} }).catch(() => undefined);
    window.location.assign('/admin/login');
  }
  return (
    <DropdownMenu
      trigger={
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm px-2 hover:bg-ink-950/5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[12px] font-semibold text-white"
            aria-hidden="true"
          >
            {initials || '?'}
          </span>
          <span className="sr-only">Account menu: </span>
          <span className="sr-only md:not-sr-only md:block md:text-left">
            <span className="block text-sm font-semibold text-ink-950">{name}</span>
            <span className="block text-[12px] text-ink-600">{email}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" className="text-ink-600" />
        </button>
      }
      items={[
        { label: 'Security & password', href: '/admin/account/security' },
        { label: 'Signed-in devices', href: '/admin/account/sessions' },
        { label: 'Notifications', href: '/admin/notifications' },
        { label: 'Sign out', onSelect: () => void signOut(), danger: true },
      ]}
    />
  );
}
