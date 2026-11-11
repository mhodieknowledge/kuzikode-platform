import { describe, expect, it } from 'vitest';
import {
  contentSecurityPolicy,
  isPrivatePath,
  openerPolicyFor,
  securityHeaders,
} from '../../src/server/lib/security-headers';

describe('security headers', () => {
  it('includes the docs/07 §8 set, HSTS only in production', () => {
    const dev = securityHeaders('development');
    expect(dev['X-Frame-Options']).toBe('DENY');
    expect(dev['X-Content-Type-Options']).toBe('nosniff');
    expect(dev['Strict-Transport-Security']).toBeUndefined();
    expect(securityHeaders('production')['Strict-Transport-Security']).toContain('max-age=63072000');
  });

  it('COOP is same-origin except around the card window (docs/06 §3b)', () => {
    expect(securityHeaders('production')['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(openerPolicyFor('/')).toBe('same-origin');
    expect(openerPolicyFor('/admin/payments')).toBe('same-origin');
    expect(openerPolicyFor('/pay/return')).toBe('same-origin');
    expect(openerPolicyFor('/pay/abcdefghijklmnopqrstuvwxyz012345')).toBe('same-origin-allow-popups');
    expect(openerPolicyFor('/portal/invoices/inv_1/pay')).toBe('same-origin-allow-popups');
    expect(openerPolicyFor('/pay/card-return')).toBe('unsafe-none');
    expect(openerPolicyFor('/dev/mock-checkout/mock_att_1')).toBe('unsafe-none');
    expect(securityHeaders('production', { openerPolicy: 'unsafe-none' })['Cross-Origin-Opener-Policy']).toBe(
      'unsafe-none',
    );
  });

  it('builds a CSP that forbids framing and objects', () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('form-action');
    expect(csp).toContain('https://challenges.cloudflare.com');
  });

  it.each([
    ['/admin', true],
    ['/admin/invoices', true],
    ['/portal/x', true],
    ['/api/v1/x', true],
    ['/q/abc', true],
    ['/i/abc', true],
    ['/pay/abc', true],
    ['/pay/return', true],
    ['/', false],
    ['/services', false],
    ['/insights/payments', false],
    ['/administration', false],
  ])('isPrivatePath(%s) = %s', (p, expected) => {
    expect(isPrivatePath(p)).toBe(expected);
  });
});
