/** Payment gateway logic (R6.2), unchanged from the pre-R6.2 PaymentGateways island: config types, account and route saves. */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAdminAction } from '../action';

export interface GatewayMethod {
  code: string;
  name: string;
  flow: string;
}
export interface GatewayAccount {
  id: string;
  providerKey: string;
  providerName: string;
  label: string;
  mode: 'test' | 'live';
  secretPrefix: string;
  currencies: string[];
  enabledMethods: string[];
  enabled: boolean;
  statusNote: string | null;
  tokenizationEnabled: boolean;
  usable: boolean;
  credentials: { fields: { name: string; present: boolean }[]; complete: boolean };
  available: { currencies: string[]; methods: GatewayMethod[] };
}
export interface GatewayRoute {
  id: string;
  appKey: string;
  currency: string;
  methodCode: string;
  accountId: string;
  accountLabel: string;
  priority: number;
  enabled: boolean;
}
export interface GatewayConfig {
  accounts: GatewayAccount[];
  routes: GatewayRoute[];
  providers: { key: string; name: string }[];
  appKey: string;
}

export const toggleIn = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

export function useGatewayConfig(initial: GatewayConfig) {
  const [config, setConfig] = useState(initial);
  const refresh = async () =>
    setConfig((await apiFetch<{ data: GatewayConfig }>('/api/v1/admin/payments/config')).data);
  const methodName = (code: string) =>
    code === '*'
      ? 'Any method'
      : (config.accounts.flatMap((a) => a.available.methods).find((m) => m.code === code)?.name ?? code);
  return { config, refresh, methodName };
}

export function useSaveAccount(onSaved: () => Promise<void>) {
  const a = useAdminAction();
  const save = (account: GatewayAccount | undefined, body: Record<string, unknown>, create: Record<string, unknown>) =>
    a.run(async () => {
      if (!account) await apiFetch('/api/v1/admin/payments/config/accounts', { body: { ...body, ...create } });
      else await apiFetch(`/api/v1/admin/payments/config/accounts/${account.id}`, { method: 'PATCH', body });
      await onSaved();
    });
  return { ...a, save };
}

export function useSaveRoute(onSaved: () => Promise<void>) {
  const a = useAdminAction();
  const save = (route: GatewayRoute | undefined, body: Record<string, unknown>) =>
    a.run(async () => {
      if (route) await apiFetch(`/api/v1/admin/payments/config/routes/${route.id}`, { method: 'PATCH', body });
      else await apiFetch('/api/v1/admin/payments/config/routes', { body });
      await onSaved();
    });
  return { ...a, save };
}

export async function deleteRoute(id: string) {
  await apiFetch(`/api/v1/admin/payments/config/routes/${id}`, { method: 'DELETE' });
}
