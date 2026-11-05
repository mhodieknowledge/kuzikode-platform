import { describe, expect, it } from 'vitest';
import { canRequestQuote, pricingLabel, quotationHref } from '../../src/shared/service-display';

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
