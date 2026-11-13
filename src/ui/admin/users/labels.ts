/** Staff status labels / tones and audit action labels for the users pages (R6.2 group 3). Pure, unit-tested. */
import type { Tone } from '../../primitives/display';

export const STAFF_STATUS_LABEL = { invited: 'Invited', active: 'Active', disabled: 'Disabled' } as const;
export const STAFF_STATUS_TONE: Record<'invited' | 'active' | 'disabled', Tone> = {
  invited: 'warn',
  active: 'ok',
  disabled: 'neutral',
};

export const USER_ACTION_LABEL: Record<string, string> = {
  'user.invited': 'Invited',
  'user.invitation_resent': 'Invitation resent',
  'user.roles_changed': 'Roles changed',
  'user.renamed': 'Renamed',
  'user.disabled': 'Account disabled',
  'user.enabled': 'Account enabled',
  'user.mfa_reset': 'Two-factor reset by an administrator',
};

/** Medium date, or "Never" (last sign-in). */
export const dayOrNever = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Africa/Harare' }).format(new Date(iso))
    : 'Never';

/** Medium date + time, or "Never". */
export const stampOrNever = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Harare' }).format(
        new Date(iso),
      )
    : 'Never';

/** True when the chosen roles differ from the saved ones (order does not matter). */
export const rolesChanged = (selected: string[], saved: string[]): boolean =>
  [...selected].sort().join() !== [...saved].sort().join();

/** Role keys → display names, falling back to the key. */
export const roleNames = (keys: string[], names: Map<string, string>): string =>
  keys.map((r) => names.get(r) ?? r).join(', ') || '—';
