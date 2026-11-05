import { describe, expect, it } from 'vitest';
import { projectRequestSchema } from '../../src/shared/schemas/enquiries';
import { indicativeEstimate, type EstimateAddon, type EstimatePackage } from '../../src/shared/wizard';

const pkg = (over: Partial<EstimatePackage> = {}): EstimatePackage => ({
  priceType: 'fixed',
  priceMinor: 75000,
  currency: 'USD',
  billingType: 'one_off',
  interval: null,
  minQuantity: 1,
  ...over,
});
const addon = (over: Partial<EstimateAddon> = {}): EstimateAddon => ({
  priceMinor: 2500,
  currency: 'USD',
  billingType: 'one_off',
  unit: 'page',
  ...over,
});

describe('indicative estimate', () => {
  it('fixed package plus one-off and recurring add-ons', () => {
    expect(
      indicativeEstimate(pkg(), [addon(), addon({ priceMinor: 3000, billingType: 'recurring', unit: 'mailbox' })]),
    ).toEqual({
      currency: 'USD',
      oneOffLowMinor: 77500,
      oneOffHighMinor: 77500,
      recurring: [{ interval: 'year', amountMinor: 3000 }],
    });
  });

  it('starting-from packages give a range up to 60% above the starting price', () => {
    expect(indicativeEstimate(pkg({ priceType: 'starting_from', priceMinor: 150000 }), [])).toMatchObject({
      oneOffLowMinor: 150000,
      oneOffHighMinor: 240000,
    });
  });

  it('recurring packages multiply by the minimum quantity per interval', () => {
    expect(
      indicativeEstimate(pkg({ priceMinor: 300, billingType: 'recurring', interval: 'month', minQuantity: 3 }), [
        addon({ priceMinor: 700, billingType: 'recurring', unit: 'month' }),
      ]),
    ).toEqual({
      currency: 'USD',
      oneOffLowMinor: 0,
      oneOffHighMinor: 0,
      recurring: [{ interval: 'month', amountMinor: 1600 }],
    });
  });

  it('no estimate for custom quotes, hidden prices, missing package or mixed currencies', () => {
    expect(indicativeEstimate(null, [addon()])).toBeNull();
    expect(indicativeEstimate(pkg({ priceType: 'custom_quote', priceMinor: null, currency: null }), [])).toBeNull();
    expect(indicativeEstimate(pkg({ priceMinor: null }), [])).toBeNull();
    expect(indicativeEstimate(pkg(), [addon({ priceMinor: null })])).toBeNull();
    expect(indicativeEstimate(pkg(), [addon({ currency: 'ZWG' })])).toBeNull();
  });
});

describe('project request schema', () => {
  const base = {
    category: 'web-development',
    budgetRange: 'Not sure yet',
    timeline: 'Flexible',
    description: 'We need a new website.',
    name: 'Ana',
    email: 'ANA@example.com',
    consent: true,
  };
  it('accepts a minimal request and normalises email and empty optionals', () => {
    const r = projectRequestSchema.parse({ ...base, package: '', websiteUrl: '' });
    expect(r).toMatchObject({ email: 'ana@example.com', addons: [], features: [] });
    expect(r.package).toBeUndefined();
    expect(r.websiteUrl).toBeUndefined();
  });
  it('rejects unknown features, non-http URLs and extra keys', () => {
    expect(projectRequestSchema.safeParse({ ...base, features: ['teleport'] }).success).toBe(false);
    expect(projectRequestSchema.safeParse({ ...base, websiteUrl: 'ftp://x.example' }).success).toBe(false);
    expect(projectRequestSchema.safeParse({ ...base, admin: true }).success).toBe(false);
  });
});
