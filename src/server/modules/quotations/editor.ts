import type { RequestContext } from '../../context';
import type { Permission } from '../../../shared/permissions';
import { editorOptions } from './service';

/** Serialisable props for the QuotationEditor island (clients, contacts, currencies, taxes, catalogue picker). */
export async function editorProps(ctx: RequestContext, permission: Permission = 'quotations.view') {
  const o = await editorOptions(ctx, permission);
  const catalogue = [
    ...o.packages.map((p) => ({
      value: `pkg:${p.id}`,
      label: `${p.service_name}: ${p.name}`,
      group: 'Packages',
      serviceId: p.service_id,
      packageId: p.id,
      description: `${p.service_name}: ${p.name} package`,
      priceMinor: p.price_type === 'custom_quote' ? null : p.price_minor,
      currency: p.currency,
      isRecurring: p.billing_type === 'recurring',
      interval: p.billing_type === 'recurring' ? (p.interval ?? 'month') : null,
      quantity: p.min_quantity,
    })),
    ...o.services.map((s) => ({
      value: `svc:${s.id}`,
      label: s.name,
      group: s.division,
      serviceId: s.id,
      packageId: null,
      description: s.name,
      priceMinor: s.pricing_model === 'custom_quote' ? null : s.price_minor,
      currency: s.currency,
      isRecurring: false,
      interval: null,
      quantity: 1,
    })),
  ];
  return {
    clients: o.clients,
    contacts: o.contacts,
    currencies: o.currencies,
    taxRates: o.taxRates.map((t) => ({ id: t.id, name: t.name, rate_bp: t.rate_bp, inclusive: t.inclusive })),
    catalogue,
  };
}
