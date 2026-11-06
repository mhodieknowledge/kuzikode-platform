import type { RequestContext } from '../context';
import { validationError } from './errors';
import { newId } from './ids';
import { computeDocument, type DiscountType } from './pricing';
import { parseQuantityMilli } from '../../shared/money';

export interface LineInput {
  serviceId?: string | null | undefined;
  packageId?: string | null | undefined;
  description: string;
  quantity: string;
  unitPriceMinor: number;
  discountType: DiscountType;
  discountValue: number;
  taxRateId?: string | null | undefined;
  isRecurring?: boolean | undefined;
  recurringInterval?: 'month' | 'year' | null | undefined;
}

export interface LinesInput {
  clientId: string;
  contactId?: string | null | undefined;
  currency: string;
  discountType: DiscountType;
  discountValue: number;
  items: LineInput[];
}

export interface PricedLine {
  id: string;
  position: number;
  serviceId: string | null;
  packageId: string | null;
  description: string;
  quantityMilli: number;
  unitPriceMinor: number;
  discountType: DiscountType;
  discountValue: number;
  taxRateId: string | null;
  taxRateBp: number;
  taxInclusive: boolean;
  isRecurring: boolean;
  recurringInterval: 'month' | 'year' | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * Validates and prices document lines (quotations, invoices) with the shared engine: checks the client, contact,
 * currency, services, packages and active tax rates, then computes every line and the document totals.
 */
export async function priceLines(ctx: RequestContext, input: LinesInput, idPrefix: 'qit' | 'iit') {
  const taxIds = [...new Set(input.items.map((i) => i.taxRateId).filter((x): x is string => !!x))];
  const serviceIds = [...new Set(input.items.map((i) => i.serviceId).filter((x): x is string => !!x))];
  const packageIds = [...new Set(input.items.map((i) => i.packageId).filter((x): x is string => !!x))];
  const [taxes, services, packages, client, contact, currency] = await ctx.db.batch([
    ctx.db
      .prepare(
        'SELECT id, rate_bp, inclusive FROM tax_rates WHERE active = 1 AND id IN (SELECT value FROM json_each(?))',
      )
      .bind(JSON.stringify(taxIds)),
    ctx.db
      .prepare('SELECT id FROM services WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(serviceIds)),
    ctx.db
      .prepare('SELECT id, service_id FROM service_packages WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(packageIds)),
    ctx.db.prepare("SELECT id FROM clients WHERE id = ? AND status = 'active'").bind(input.clientId),
    ctx.db
      .prepare('SELECT id FROM client_contacts WHERE id = ? AND client_id = ?')
      .bind(input.contactId ?? '', input.clientId),
    ctx.db.prepare('SELECT code FROM currencies WHERE code = ? AND active = 1').bind(input.currency),
  ]);
  const taxMap = new Map(
    ((taxes?.results ?? []) as { id: string; rate_bp: number; inclusive: number }[]).map((t) => [t.id, t]),
  );
  const fields: Record<string, string[]> = {};
  if (!(client?.results ?? []).length) fields['clientId'] = ['Choose an active client.'];
  if (input.contactId && !(contact?.results ?? []).length) fields['contactId'] = ['Choose a contact of this client.'];
  if (!(currency?.results ?? []).length) fields['currency'] = ['Choose an active currency.'];
  if ((services?.results ?? []).length !== serviceIds.length)
    fields['items'] = ['A line refers to an unknown service.'];
  if ((packages?.results ?? []).length !== packageIds.length)
    fields['items'] = ['A line refers to an unknown package.'];
  input.items.forEach((it, i) => {
    if (it.taxRateId && !taxMap.has(it.taxRateId)) fields[`items.${i}.taxRateId`] = ['Choose an active tax rate.'];
  });
  if (Object.keys(fields).length) throw validationError(fields);

  const lines = input.items.map((it) => {
    const tax = it.taxRateId ? taxMap.get(it.taxRateId)! : null;
    return {
      it,
      quantityMilli: parseQuantityMilli(it.quantity),
      taxRateBp: tax?.rate_bp ?? 0,
      taxInclusive: tax?.inclusive === 1,
    };
  });
  let doc;
  try {
    doc = computeDocument({
      lines: lines.map((l) => ({
        quantityMilli: l.quantityMilli,
        unitPriceMinor: l.it.unitPriceMinor,
        discount: { type: l.it.discountType, value: l.it.discountValue },
        taxRateBp: l.taxRateBp,
        taxInclusive: l.taxInclusive,
      })),
      discount: { type: input.discountType, value: input.discountValue },
    });
  } catch (err) {
    throw validationError({ items: [err instanceof Error ? err.message : 'The amounts are out of range.'] });
  }
  const base = newId(idPrefix, ctx.now().getTime());
  const items: PricedLine[] = lines.map((l, i) => {
    const r = doc.lines[i]!;
    return {
      id: `${base}_${i}`,
      position: i,
      serviceId: l.it.serviceId ?? null,
      packageId: l.it.packageId ?? null,
      description: l.it.description,
      quantityMilli: l.quantityMilli,
      unitPriceMinor: l.it.unitPriceMinor,
      discountType: l.it.discountType,
      discountValue: l.it.discountType === 'none' ? 0 : l.it.discountValue,
      taxRateId: l.it.taxRateId ?? null,
      taxRateBp: l.taxRateBp,
      taxInclusive: l.taxInclusive,
      isRecurring: l.it.isRecurring ?? false,
      recurringInterval: l.it.isRecurring ? (l.it.recurringInterval ?? null) : null,
      subtotal: r.subtotalMinor,
      discount: r.discountMinor,
      tax: r.taxMinor,
      total: r.totalMinor,
    };
  });
  return { items, totals: doc };
}
