/**
 * Logic of the staff users and roles islands (R6.2 group 3), carried over unchanged from the pre-redesign
 * `components/admin/UsersAdmin.tsx`. The server re-checks every permission; these only shape the UI.
 */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export interface RoleOption {
  key: string;
  name: string;
  description: string | null;
}

export interface PermissionGroup {
  module: string;
  items: { key: string; description: string; reserved: boolean }[];
}

export interface RoleValues {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
  members: number;
}

export function useInvite() {
  const a = useAdminAction();
  const invite = (f: FormData, roles: string[]) =>
    a.run(async () => {
      const res = await apiFetch<{ data: { userId: string } }>('/api/v1/admin/users', {
        body: { name: f.get('name'), email: f.get('email'), roles },
      });
      window.location.assign(`/admin/users/${res.data.userId}`);
    });
  return { ...a, invite };
}

export function useStaffRecord(userId: string) {
  const a = useAdminAction();
  const [saved, setSaved] = useState<string | null>(null);
  const base = `/api/v1/admin/users/${encodeURIComponent(userId)}`;
  const post = (path: string, then: () => void) =>
    a.run(async () => {
      await apiFetch(`${base}${path}`, { method: 'POST', body: {} });
      then();
    });
  return {
    ...a,
    saved,
    saveName: (name: string) =>
      a.run(async () => {
        await apiFetch(base, { method: 'PATCH', body: { name } });
        setSaved('Name saved.');
      }),
    saveRoles: (roles: string[]) =>
      a.run(async () => {
        await apiFetch(`${base}/roles`, { method: 'PUT', body: { roles } });
        reload();
      }),
    resendInvitation: () =>
      post('/invitation', () => setSaved('A new invitation email is on its way. Earlier links no longer work.')),
    enable: () => post('/enable', reload),
    disable: () => post('/disable', reload),
    resetMfa: () => post('/mfa/reset', reload),
  };
}

export function useRoleSave(role?: RoleValues) {
  const a = useAdminAction();
  return {
    ...a,
    save: (f: FormData, permissions: string[]) =>
      a.run(async () => {
        const body = { name: f.get('name'), description: f.get('description') || undefined, permissions };
        if (role) await apiFetch(`/api/v1/admin/roles/${role.id}`, { method: 'PUT', body });
        else await apiFetch('/api/v1/admin/roles', { body: { ...body, key: f.get('key') } });
        reload();
      }),
    remove: () =>
      a.run(async () => {
        await apiFetch(`/api/v1/admin/roles/${role!.id}`, { method: 'DELETE' });
        reload();
      }),
  };
}
