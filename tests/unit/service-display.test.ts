import { describe, expect, it } from 'vitest';
import {
  canRequestQuote,
  packagePrice,
  pricingLabel,
  quotationHref,
  startProjectHref,
  whatsappHref,
} from '../../src/shared/service-display';

describe('service display rules', () => {
  it('labels pricing models and hides prices when the switch is off', () => {
    expect(pricingLabel('custom_quote', null, null, true)).toBe('Priced per project');
    expect(pricingLabel('fixed', 35000, 'USD', true)).toBe('$350.00 fixed price');
    expect(pricingLabel('starting_from', 150000, 'USD', true)).toBe('From $1,500.00');
    expect(pricingLabel('hourly', 2500, 'USD', true)).toBe('$25.00 per hour');
    expect(pricingLabel('fixed', 35000, 'USD', false)).toBe('Price on request');
    expect(pricingLabel('hourly', 2500, 'USD', false)).toBe('Billed by the hour');
  });

  it('only active divisions and services can be quoted', () => {
    expect(canRequestQuote('active')).toBe(true);
    expect(canRequestQuote('coming_soon')).toBe(false);
    expect(canRequestQuote('active', 'coming_soon')).toBe(false);
  });

  it('preselects division and service on the contact form', () => {
    expect(quotationHref('web-development', 'e-commerce')).toBe('/contact?category=web-development&service=e-commerce');
  });
});

describe('package price display (docs/12 §A.1)', () => {
  const base = {
    priceType: 'fixed' as const,
    priceMinor: 35000,
    annualPriceMinor: null,
    currency: 'USD',
    billingType: 'one_off' as const,
    interval: null,
    priceUnit: null,
  };

  it('formats fixed, starting-from, recurring and per-unit prices', () => {
    expect(packagePrice(base)).toEqual({
      prefix: null,
      amount: '$350',
      suffix: 'one-off',
      annual: null,
      hasPrice: true,
    });
    expect(packagePrice({ ...base, priceType: 'starting_from', priceMinor: 150000 })).toMatchObject({
      prefix: 'From',
      amount: '$1,500',
    });
    expect(
      packagePrice({ ...base, billingType: 'recurring', interval: 'month', priceMinor: 2500, annualPriceMinor: 25000 }),
    ).toMatchObject({ amount: '$25', suffix: 'per month', annual: 'or $250 per year' });
    expect(packagePrice({ ...base, priceMinor: 2500, priceUnit: 'per hour' })).toMatchObject({ suffix: 'per hour' });
    expect(packagePrice({ ...base, priceMinor: 1250 }).amount).toBe('$12.50');
  });

  it('hidden prices read "Request a quote"; custom quotes read "Custom quote"', () => {
    expect(packagePrice({ ...base, priceMinor: null })).toMatchObject({ amount: 'Request a quote', hasPrice: false });
    expect(packagePrice({ ...base, priceType: 'custom_quote', priceMinor: null, currency: null })).toMatchObject({
      amount: 'Custom quote',
      hasPrice: false,
    });
  });

  it('"Get started" opens the wizard with the package preselected', () => {
    expect(startProjectHref('business-website')).toBe('/start-a-project?package=business-website');
  });
});

describe('WhatsApp link (docs/12 §C.9)', () => {
  it('builds a wa.me link with the prefilled message, or nothing when unconfigured', () => {
    expect(whatsappHref('+263 77 123 4567', "Hi Kuzikode, I'm interested in the Business Website plan.")).toBe(
      "https://wa.me/263771234567?text=Hi%20Kuzikode%2C%20I'm%20interested%20in%20the%20Business%20Website%20plan.",
    );
    expect(whatsappHref('', 'x')).toBeNull();
    expect(whatsappHref(undefined, 'x')).toBeNull();
    expect(whatsappHref('12345', 'x')).toBeNull();
  });
});
