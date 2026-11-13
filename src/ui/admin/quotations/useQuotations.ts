/**
 * Quotation logic (R6.2), carried over unchanged from the pre-R6.2 QuotationsAdmin island: saving a draft, the package
 * picker (prices copied from the server at this moment) and the actions on a quotation (send, record a response, void,
 * convert, create a project, revise, duplicate, delete).
 */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';
import { newLine, type EditorLine } from '../documents/lines';

export interface PickerPackage {
  id: string;
  name: string;
  serviceName: string;
  priceMinor: number;
  currency: string;
  altPriceZwgMinor: number | null;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  minQuantity: number;
  addons: { id: string; name: string; priceMinor: number; currency: string; unit: string }[];
}

interface ApiLine {
  serviceId: string | null;
  packageId: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number;
  isRecurring: boolean;
  recurringInterval: 'month' | 'year' | null;
}

export function useQuotationSave(id: string | undefined) {
  const a = useAdminAction();
  const save = (body: Record<string, unknown>) =>
    a.run(async () => {
      if (id) {
        await apiFetch(`/api/v1/admin/quotations/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/quotations/${id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/quotations', { body });
        window.location.assign(`/admin/quotations/${res.data.id}`);
      }
    });
  return { ...a, save };
}

export function usePackagePicker(currency: string) {
  const a = useAdminAction();
  const [list, setList] = useState<PickerPackage[] | null>(null);
  const load = () =>
    a.run(async () => {
      if (list) return;
      const res = await apiFetch<{ data: PickerPackage[] }>('/api/v1/admin/packages/picker');
      setList(res.data);
    });
  /** Lines for a package and its chosen add-ons, priced by the server in the document currency. */
  const linesFor = (pkg: PickerPackage, addons: Record<string, number>, onAdd: (lines: EditorLine[]) => void) =>
    a.run(async () => {
      const res = await apiFetch<{ data: ApiLine[] }>(`/api/v1/admin/packages/${pkg.id}/quote-lines`, {
        body: { currency, addons: Object.entries(addons).map(([id, quantity]) => ({ id, quantity })) },
      });
      onAdd(
        res.data.map((l) =>
          newLine({
            serviceId: l.serviceId,
            packageId: l.packageId,
            description: l.description,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            isRecurring: l.isRecurring,
            recurringInterval: l.recurringInterval,
          }),
        ),
      );
    });
  return { ...a, list, load, linesFor };
}

export function useQuotationActions(id: string) {
  const a = useAdminAction();
  const post = (path: string, body: Record<string, unknown>, then: (data: { id: string }) => void) =>
    a.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>(`/api/v1/admin/quotations/${id}${path}`, { body });
      then(res.data);
    });
  return {
    ...a,
    send: (message: FormDataEntryValue | null) => post('/send', { message }, () => reload()),
    accept: (name: FormDataEntryValue | null, agree: boolean) =>
      post('/response', { decision: 'accept', name, agree }, () => reload()),
    reject: (reason: FormDataEntryValue | null) => post('/response', { decision: 'reject', reason }, () => reload()),
    voidIt: (reason: FormDataEntryValue | null) => post('/void', { reason }, () => reload()),
    convert: () => post('/convert', {}, () => reload()),
    revise: () => post('/revise', {}, (d) => window.location.assign(`/admin/quotations/${d.id}/edit`)),
    duplicate: () => post('/duplicate', {}, (d) => window.location.assign(`/admin/quotations/${d.id}/edit`)),
    project: () =>
      a.run(async () => {
        const res = await apiFetch<{ data: { projectId: string } }>(`/api/v1/admin/projects/from-quotation/${id}`, {
          body: {},
        });
        window.location.assign(`/admin/projects/${res.data.projectId}`);
      }),
    remove: () =>
      a.run(async () => {
        await apiFetch(`/api/v1/admin/quotations/${id}`, { method: 'DELETE' });
        window.location.assign('/admin/quotations');
      }),
  };
}

/** Picker label price: the package's own currency, the ZWG alternative price, or a note that there is no price. */
export function pickerPrice(p: PickerPackage, currency: string, fmt: (minor: number, cur: string) => string): string {
  if (p.currency === currency) return fmt(p.priceMinor, p.currency);
  if (currency === 'ZWG' && p.altPriceZwgMinor != null) return fmt(p.altPriceZwgMinor, 'ZWG');
  return `${fmt(p.priceMinor, p.currency)} (no ${currency} price)`;
}
