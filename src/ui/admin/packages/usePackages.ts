/**
 * Logic of the Packages & pricing admin islands (R6.2 group 4), carried over unchanged from the pre-redesign PackagesAdmin:
 * price approval, the package save body (annual price only for monthly recurring, text only for "a value" features) and add-on
 * writes. Presentation only: prices, validation and endpoints are untouched.
 */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';
import { effectiveSlug } from '../website/lib';

export type Tab = 'websites' | 'care' | 'email' | 'other';
export const TABS: { value: Tab; label: string }[] = [
  { value: 'websites', label: 'Websites' },
  { value: 'care', label: 'Care plans' },
  { value: 'email', label: 'Email & domains' },
  { value: 'other', label: 'Other services' },
];
export const UNITS = [
  { value: 'each', label: 'Each' },
  { value: 'page', label: 'Per page' },
  { value: 'mailbox', label: 'Per mailbox' },
  { value: 'month', label: 'Per month' },
  { value: 'year', label: 'Per year' },
  { value: 'hour', label: 'Per hour' },
];
export const unitLabel = (u: string) => UNITS.find((x) => x.value === u)?.label ?? u;

export interface PackageRowView {
  id: string;
  name: string;
  serviceName: string;
  tab: Tab;
  status: string;
  price: string;
  priceReviewRequired: boolean;
  mostPopular: boolean;
}

export interface FeatureValue {
  label: string;
  value: 'included' | 'not_included' | 'text';
  text: string | null;
  tooltip: string | null;
  key: string | null;
}

export interface PackageFormValues {
  id?: string;
  serviceId: string;
  slug: string;
  name: string;
  tagline: string | null;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  priceType: 'fixed' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  currency: string | null;
  priceUnit: string | null;
  altPriceZwgMinor: number | null;
  annualPriceMinor: number | null;
  minQuantity: number;
  deliveryTime: string | null;
  revisionRounds: string | null;
  supportPeriod: string | null;
  mostPopular: boolean;
  tab: Tab;
  status: 'active' | 'coming_soon' | 'inactive';
  costNote: string | null;
  priceReviewRequired?: boolean;
  features: FeatureValue[];
}

export const blankFeature = (): FeatureValue => ({
  label: '',
  value: 'included',
  text: null,
  tooltip: null,
  key: null,
});

/** The body sent for a package, shaped exactly as the pre-redesign editor did. */
export function packageBody(v: PackageFormValues, slugTouched: boolean, currency: string) {
  const { id: _id, priceReviewRequired: _r, ...rest } = v;
  const priced = v.priceType !== 'custom_quote';
  return {
    ...rest,
    slug: effectiveSlug(v.slug, slugTouched, v.name),
    currency: priced ? currency : null,
    interval: v.billingType === 'recurring' ? (v.interval ?? 'month') : null,
    annualPriceMinor: v.billingType === 'recurring' && v.interval === 'month' ? v.annualPriceMinor : null,
    features: v.features.map((f) => ({ ...f, text: f.value === 'text' ? f.text : null })),
  };
}

export function useApprovePrices() {
  const a = useAdminAction();
  const approve = (ids: string[]) =>
    a.run(async () => {
      await apiFetch('/api/v1/admin/packages/approve-prices', { body: { ids } });
      reload();
    });
  return { ...a, approve };
}

export function usePackageSave(id?: string) {
  const a = useAdminAction();
  const save = (body: unknown) =>
    a.run(async () => {
      if (id) await apiFetch(`/api/v1/admin/packages/${id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/packages', { body });
      window.location.assign('/admin/packages?saved=1');
    });
  const remove = () => apiFetch(`/api/v1/admin/packages/${id}`, { method: 'DELETE' });
  return { ...a, save, remove };
}

export interface AddonView {
  id: string;
  packageId: string | null;
  packageName: string | null;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  unit: string;
  billingType: 'one_off' | 'recurring';
  active: boolean;
}

export type AddonDraft = Omit<AddonView, 'id' | 'packageName'> & { id?: string };
export const blankAddon = (currency: string): AddonDraft => ({
  packageId: null,
  name: '',
  description: null,
  priceMinor: 0,
  currency,
  unit: 'each',
  billingType: 'one_off',
  active: true,
});

export function useAddons() {
  const a = useAdminAction();
  const [draft, setDraft] = useState<AddonDraft | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const set = <K extends keyof AddonDraft>(k: K, val: AddonDraft[K]) => setDraft((d) => (d ? { ...d, [k]: val } : d));
  const save = () =>
    a.run(async () => {
      if (!draft || priceError) return;
      const { id, ...body } = draft;
      if (id) await apiFetch(`/api/v1/admin/packages/addons/${id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/packages/addons', { body });
      reload();
    });
  const remove = (id: string) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/packages/addons/${id}`, { method: 'DELETE' });
      reload();
    });
  return { ...a, draft, setDraft, set, priceError, setPriceError, save, remove };
}
