/**
 * Client administration logic (R6.2), carried over unchanged from the pre-R6.2 ClientsAdmin island: the create / edit body
 * (with an optional main contact on create), contacts, notes, portal access, archive / restore / delete and portal sign-ups.
 */
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface ClientFormValues {
  id?: string;
  type: 'individual' | 'business';
  displayName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxNumber: string | null;
  billingAddress: Address | null;
  defaultCurrency: string;
  paymentTermsDays: number;
  notes: string | null;
  tags: string[];
}

export interface ContactItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  isBilling: boolean;
}

export interface AccessItem {
  id: string;
  role: 'owner' | 'member' | 'billing';
  status: 'pending' | 'active' | 'revoked';
  name: string;
  email: string;
  userStatus: string;
}

export type PortalRole = AccessItem['role'];
export const PORTAL_ROLE_OPTIONS: { value: PortalRole; label: string }[] = [
  { value: 'member', label: 'Member: projects, documents and support' },
  { value: 'billing', label: 'Billing: invoices and payments' },
  { value: 'owner', label: 'Owner: everything' },
];

const addr = (f: FormData, prefix: string): Address => ({
  line1: String(f.get(`${prefix}.line1`) ?? ''),
  line2: String(f.get(`${prefix}.line2`) ?? ''),
  city: String(f.get(`${prefix}.city`) ?? ''),
  region: String(f.get(`${prefix}.region`) ?? ''),
  postalCode: String(f.get(`${prefix}.postalCode`) ?? ''),
  country: String(f.get(`${prefix}.country`) ?? ''),
});

/** Comma-separated tags → trimmed, non-empty list. */
export const parseTags = (raw: string) =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/** The client API body from the form (unchanged field names); a main contact only on create and only when named. */
export function clientBody(f: FormData, type: ClientFormValues['type'], editing: boolean) {
  const body: Record<string, unknown> = {
    type,
    displayName: f.get('displayName'),
    legalName: f.get('legalName'),
    email: f.get('email'),
    phone: f.get('phone'),
    website: f.get('website'),
    taxNumber: f.get('taxNumber'),
    billingAddress: addr(f, 'billing'),
    defaultCurrency: f.get('defaultCurrency'),
    paymentTermsDays: Number(f.get('paymentTermsDays')),
    notes: f.get('notes'),
    tags: parseTags(String(f.get('tags') ?? '')),
  };
  const contactName = String(f.get('contact.name') ?? '').trim();
  if (!editing && contactName) {
    body['primaryContact'] = {
      name: contactName,
      email: f.get('contact.email'),
      phone: f.get('contact.phone'),
      jobTitle: f.get('contact.jobTitle'),
      isPrimary: true,
      isBilling: true,
    };
  }
  return body;
}

export function useClientSave(id: string | undefined) {
  const a = useAdminAction();
  const save = (body: Record<string, unknown>) =>
    a.run(async () => {
      if (id) {
        await apiFetch(`/api/v1/admin/clients/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/clients/${id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/clients', { body });
        window.location.assign(`/admin/clients/${res.data.id}`);
      }
    });
  return { ...a, save };
}

export function useClientRecord(clientId: string) {
  const a = useAdminAction();
  const base = `/api/v1/admin/clients/${clientId}`;
  return {
    ...a,
    saveContact: (contactId: string | null, body: Record<string, unknown>) =>
      a.run(async () => {
        if (contactId) await apiFetch(`${base}/contacts/${contactId}`, { method: 'PUT', body });
        else await apiFetch(`${base}/contacts`, { body });
        reload();
      }),
    removeContact: (contactId: string) =>
      a.run(async () => {
        await apiFetch(`${base}/contacts/${contactId}`, { method: 'DELETE' });
        reload();
      }),
    addNote: (body: string) =>
      a.run(async () => {
        await apiFetch(`${base}/notes`, { body: { body } });
        reload();
      }),
    invite: (contactId: string, role: PortalRole, onSent: () => void) =>
      a.run(async () => {
        await apiFetch(`${base}/portal/invitations`, { body: { contactId, role } });
        onSent();
        window.setTimeout(reload, 800);
      }),
    access: (accessId: string, action: 'approve' | 'revoke') =>
      a.run(async () => {
        await apiFetch(`${base}/portal/access/${accessId}`, { body: { action } });
        reload();
      }),
    archive: () =>
      a.run(async () => {
        await apiFetch(`${base}/archive`, { method: 'POST', body: {} });
        reload();
      }),
    restore: () =>
      a.run(async () => {
        await apiFetch(`${base}/restore`, { method: 'POST', body: {} });
        reload();
      }),
    remove: () =>
      a.run(async () => {
        await apiFetch(base, { method: 'DELETE' });
        window.location.assign('/admin/clients');
      }),
  };
}

export function usePortalSignup(userId: string) {
  const a = useAdminAction();
  const base = `/api/v1/admin/clients/portal-signups/${encodeURIComponent(userId)}`;
  return {
    ...a,
    link: (clientId: string, role: PortalRole) =>
      a.run(async () => {
        await apiFetch(`${base}/link`, { body: { clientId, role } });
        reload();
      }),
    decline: () =>
      a.run(async () => {
        await apiFetch(`${base}/decline`, { method: 'POST', body: {} });
        reload();
      }),
  };
}

/** Portal access status in words. */
export const accessStatusLabel = (x: Pick<AccessItem, 'status' | 'userStatus'>) =>
  x.status === 'pending'
    ? x.userStatus === 'invited'
      ? 'Invitation sent'
      : 'Waiting for approval'
    : x.status === 'active'
      ? 'Active'
      : 'Revoked';
