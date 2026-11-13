/**
 * Subscription and managed-service logic (R6.2), carried over unchanged from the pre-R6.2 SubscriptionsAdmin island: saving
 * a subscription or a register entry, pause / resume / cancel and deleting an entry.
 */
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export interface SubscriptionFormValues {
  id?: string;
  clientId: string;
  packageId: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number | null;
  currency: string;
  taxRateId: string | null;
  interval: 'month' | 'year';
  startDate: string;
  nextBillingDate: string | null;
  autoIssue: boolean;
}

export interface AssetFormValues {
  id?: string;
  clientId: string;
  type: 'domain' | 'hosting' | 'email_tenant' | 'ssl' | 'app_store_account' | 'other';
  name: string;
  provider: string | null;
  subscriptionId: string | null;
  renewalDate: string | null;
  autoRenew: boolean;
  billableToClient: boolean;
  costNote: string | null;
  credentialsNote: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'transferred';
}

export const ASSET_TYPE_OPTIONS = [
  { value: 'domain', label: 'Domain' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'email_tenant', label: 'Email (tenant / mailboxes)' },
  { value: 'ssl', label: 'SSL certificate' },
  { value: 'app_store_account', label: 'App store account' },
  { value: 'other', label: 'Other' },
];

export const ASSET_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'transferred', label: 'Transferred away' },
];

export function useSubscriptionSave(id: string | undefined) {
  const a = useAdminAction();
  const save = (values: SubscriptionFormValues) =>
    a.run(async () => {
      const { id: _id, ...body } = values;
      if (id) {
        await apiFetch(`/api/v1/admin/subscriptions/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/subscriptions/${id}?saved=1`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/subscriptions', { body });
        window.location.assign(`/admin/subscriptions/${res.data.id}`);
      }
    });
  return { ...a, save };
}

export function useSubscriptionActions(id: string) {
  const a = useAdminAction();
  const post = (path: string, body: unknown = {}) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/subscriptions/${id}/${path}`, { body });
      reload();
    });
  return {
    ...a,
    pause: () => post('pause'),
    resume: () => post('resume'),
    cancel: (reason: string, date: string) => post('cancel', { reason, effectiveDate: date || null }),
  };
}

export function useAssetSave(id: string | undefined) {
  const a = useAdminAction();
  const save = (values: AssetFormValues) =>
    a.run(async () => {
      const { id: _id, ...body } = values;
      if (id) await apiFetch(`/api/v1/admin/assets/${id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/assets', { body });
      window.location.assign('/admin/assets?saved=1');
    });
  const remove = () =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/assets/${id}`, { method: 'DELETE' });
      window.location.assign('/admin/assets');
    });
  return { ...a, save, remove };
}
