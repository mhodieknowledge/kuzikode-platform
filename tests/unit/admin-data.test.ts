import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/ui/lib/api';
import { CHECK_FIELDS, GENERIC_ERROR, describeError, fieldError } from '../../src/ui/admin/action';
import { chartScale, niceMax } from '../../src/ui/admin/chart';
import { activeFilters, type FilterField } from '../../src/ui/admin/FilterBar';
import {
  addCatalogueLine,
  docDiscountFrom,
  fromApiLine,
  isBlankLine,
  moveLine,
  newLine,
  previewLines,
  toApiDiscount,
  toApiLines,
  type CatalogueOption,
} from '../../src/ui/admin/documents/lines';
import { accessStatusLabel, clientBody, parseTags } from '../../src/ui/admin/clients/useClients';
import { leadBody } from '../../src/ui/admin/leads/useLeads';

describe('admin chart scale (R6.2)', () => {
  it('rounds the axis up to 1, 2, 2.5 or 5 × 10^n', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(1.2)).toBe(2);
    expect(niceMax(2.1)).toBe(2.5);
    expect(niceMax(4100)).toBe(5000);
    expect(niceMax(7300)).toBe(10000);
  });
  it('gives quarter ticks and flags an empty series', () => {
    expect(chartScale([0, 0])).toEqual({ top: 1, ticks: [0, 0.25, 0.5, 0.75, 1], allZero: true });
    const s = chartScale([120, 380, Number.NaN]);
    expect(s.top).toBe(500);
    expect(s.ticks).toEqual([0, 125, 250, 375, 500]);
    expect(s.allZero).toBe(false);
  });
});

describe('admin action errors (R6.2)', () => {
  it('maps a 422 to the field errors and the generic "check the fields" line', () => {
    const err = new ApiError(422, {
      code: 'VALIDATION',
      message: 'Invalid',
      fields: { title: ['Give the lead a title.'] },
    });
    expect(describeError(err)).toEqual({ message: CHECK_FIELDS, fields: { title: ['Give the lead a title.'] } });
    expect(fieldError({ title: ['a', 'b'] }, 'title')).toBe('a');
    expect(fieldError({}, 'title')).toBeUndefined();
  });
  it('keeps other API messages and hides unknown errors', () => {
    expect(describeError(new ApiError(409, { code: 'CONFLICT', message: 'Already converted' })).message).toBe(
      'Already converted',
    );
    expect(describeError(new Error('boom'))).toEqual({ message: GENERIC_ERROR, fields: {} });
  });
});

describe('admin filter bar (R6.2)', () => {
  it('counts filters set away from their defaults (search excluded)', () => {
    const fields: FilterField[] = [
      { kind: 'search', name: 'q', label: 'Search', value: 'acme' },
      {
        kind: 'select',
        name: 'status',
        label: 'Status',
        value: 'active',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'all', label: 'All' },
        ],
      },
      { kind: 'check', name: 'due', label: 'Follow-up due', checked: false },
    ];
    expect(activeFilters(fields)).toBe(0);
    expect(
      activeFilters([
        fields[0]!,
        { ...(fields[1] as Extract<FilterField, { kind: 'select' }>), value: 'all' },
        { kind: 'check', name: 'due', label: 'Follow-up due', checked: true },
      ]),
    ).toBe(2);
  });
});

describe('document line items (R6.2)', () => {
  const tax = [{ id: 'tax_vat', name: 'VAT 15.5%', rate_bp: 1550, inclusive: 0 }];
  it('previews the e2e quotation: 3 lines, 5% overall discount, VAT on line 3 → 1,081.67', () => {
    const lines = [
      newLine({ description: 'Build', unitPriceMinor: 90000 }),
      newLine({ description: 'Photos', quantity: '20', unitPriceMinor: 500 }),
      newLine({ description: 'Hosting', unitPriceMinor: 12000, taxRateId: 'tax_vat' }),
    ];
    const p = previewLines(lines, tax, { type: 'percent', percent: '5', amountMinor: null });
    expect(p.totals?.totalMinor).toBe(108167);
    expect(p.totals?.lines).toHaveLength(3);
  });
  it('withholds totals while a quantity or percent does not parse', () => {
    const p = previewLines([newLine({ quantity: '1.2345', unitPriceMinor: 100 })], [], docDiscountFrom('none', 0));
    expect(p.parsed[0]!.qty).toBeNull();
    expect(p.totals).toBeNull();
    const q = previewLines([newLine({ unitPriceMinor: 100 })], [], {
      type: 'percent',
      percent: 'abc',
      amountMinor: null,
    });
    expect(q.docPct).toBeNull();
    expect(q.totals).toBeNull();
  });
  it('round-trips stored lines and discounts', () => {
    const l = fromApiLine({
      service_id: 'svc_1',
      package_id: null,
      description: 'Design',
      quantity_milli: 2500,
      unit_price_minor: 1000,
      discount_type: 'percent',
      discount_value: 1000,
      tax_rate_id: null,
      is_recurring: 1,
      recurring_interval: 'month',
    });
    expect(l.quantity).toBe('2.5');
    expect(l.discountPercent).toBe('10');
    expect(toApiLines([l])[0]).toMatchObject({
      quantity: '2.5',
      discountType: 'percent',
      discountValue: 1000,
      isRecurring: true,
      recurringInterval: 'month',
    });
    expect(toApiDiscount(docDiscountFrom('amount', 500))).toEqual({ discountType: 'amount', discountValue: 500 });
    expect(toApiDiscount(docDiscountFrom('percent', 250))).toEqual({ discountType: 'percent', discountValue: 250 });
  });
  it('reorders and inserts catalogue lines, replacing blank rows', () => {
    expect(moveLine(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveLine(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    const c: CatalogueOption = {
      value: 'pkg_1',
      label: 'Starter',
      group: 'Websites',
      serviceId: 'svc_1',
      packageId: 'pkg_1',
      description: 'Starter website',
      priceMinor: 30000,
      currency: 'USD',
      isRecurring: true,
      interval: 'year',
      quantity: 1,
    };
    const blank = newLine();
    expect(isBlankLine(blank)).toBe(true);
    const usd = addCatalogueLine([blank], c, 'USD', true);
    expect(usd).toHaveLength(1);
    expect(usd[0]).toMatchObject({ unitPriceMinor: 30000, isRecurring: true, recurringInterval: 'year' });
    const zwg = addCatalogueLine([newLine({ description: 'Keep me' })], c, 'ZWG', false);
    expect(zwg).toHaveLength(2);
    expect(zwg[1]).toMatchObject({ unitPriceMinor: null, isRecurring: false, recurringInterval: null });
  });
});

describe('admin form bodies (R6.2)', () => {
  const form = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };
  it('builds the client body, adding a main contact only on create and only when named', () => {
    const f = form({
      displayName: 'Acme',
      'billing.city': 'Mutare',
      tags: ' retail, , priority ',
      paymentTermsDays: '14',
    });
    const b = clientBody(f, 'business', false);
    expect(b['tags']).toEqual(['retail', 'priority']);
    expect(b['paymentTermsDays']).toBe(14);
    expect((b['billingAddress'] as { city: string }).city).toBe('Mutare');
    expect(b['primaryContact']).toBeUndefined();
    f.set('contact.name', ' Farai ');
    expect(clientBody(f, 'business', false)['primaryContact']).toMatchObject({ name: 'Farai', isPrimary: true });
    expect(clientBody(f, 'business', true)['primaryContact']).toBeUndefined();
    expect(parseTags('a,b , ,c')).toEqual(['a', 'b', 'c']);
  });
  it('builds the lead body: currency only with a value, lost reason only when lost', () => {
    const f = form({ title: 'Lodge', lostReason: 'Price', assignedTo: '', nextFollowUpOn: '' });
    const open = leadBody(f, { status: 'new', value: null, currency: 'USD', serviceIds: [] });
    expect(open).toMatchObject({ currency: null, lostReason: undefined, assignedTo: null, nextFollowUpOn: null });
    const lost = leadBody(f, { status: 'lost', value: 250000, currency: 'USD', serviceIds: ['svc_1'] });
    expect(lost).toMatchObject({ currency: 'USD', lostReason: 'Price', estimatedValueMinor: 250000 });
  });
  it('words portal access states', () => {
    expect(accessStatusLabel({ status: 'pending', userStatus: 'invited' })).toBe('Invitation sent');
    expect(accessStatusLabel({ status: 'pending', userStatus: 'active' })).toBe('Waiting for approval');
    expect(accessStatusLabel({ status: 'active', userStatus: 'active' })).toBe('Active');
    expect(accessStatusLabel({ status: 'revoked', userStatus: 'active' })).toBe('Revoked');
  });
});
