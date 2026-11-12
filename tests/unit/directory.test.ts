import { describe, expect, it } from 'vitest';
import { divisionFromPrice, fromSuffix, type DirectoryPackage } from '../../src/shared/directory';

const pkg = (over: Partial<DirectoryPackage>): DirectoryPackage => ({
  categorySlug: 'web-development',
  status: 'active',
  priceType: 'fixed',
  priceMinor: 35000,
  annualPriceMinor: null,
  currency: 'USD',
  billingType: 'one_off',
  interval: null,
  priceUnit: null,
  ...over,
});

describe('divisionFromPrice', () => {
  it('returns the lowest one-off price of the division', () => {
    const r = divisionFromPrice(
      [pkg({ priceMinor: 75000 }), pkg({ priceMinor: 35000 }), pkg({ priceMinor: 150000, priceType: 'starting_from' })],
      'web-development',
    );
    expect(r).toEqual({ amount: '$350', suffix: 'one-off' });
  });

  it('prefers one-off packages over cheaper recurring ones', () => {
    const r = divisionFromPrice(
      [pkg({ priceMinor: 2500, billingType: 'recurring', interval: 'month' }), pkg({ priceMinor: 35000 })],
      'web-development',
    );
    expect(r?.amount).toBe('$350');
  });

  it('falls back to recurring prices with their unit when nothing is one-off', () => {
    const r = divisionFromPrice(
      [
        pkg({
          categorySlug: 'cloud-it',
          priceMinor: 300,
          billingType: 'recurring',
          interval: 'month',
          priceUnit: 'mailbox',
        }),
      ],
      'cloud-it',
    );
    expect(r).toEqual({ amount: '$3', suffix: 'per mailbox / month' });
  });

  it('ignores custom quotes, hidden prices, coming-soon packages and other divisions', () => {
    const r = divisionFromPrice(
      [
        pkg({ priceType: 'custom_quote', priceMinor: null }),
        pkg({ priceMinor: null }),
        pkg({ status: 'coming_soon', priceMinor: 100 }),
        pkg({ categorySlug: 'ai-data', priceMinor: 100 }),
      ],
      'web-development',
    );
    expect(r).toBeNull();
  });
});

describe('fromSuffix', () => {
  it('shows nothing for one-off prices and a short unit otherwise', () => {
    expect(fromSuffix({ amount: '$350', suffix: 'one-off' })).toBe('');
    expect(fromSuffix({ amount: '$25', suffix: 'per hour' })).toBe(' / hour');
    expect(fromSuffix({ amount: '$3', suffix: 'per mailbox / month' })).toBe(' / mailbox / month');
  });
});
