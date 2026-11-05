import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, isPrivatePath, securityHeaders } from '../../src/server/lib/security-headers';

describe('security headers', () => {
  it('includes the docs/07 §8 set, HSTS only in production', () => {
    const dev = securityHeaders('development');
    expect(dev['X-Frame-Options']).toBe('DENY');
    expect(dev['X-Content-Type-Options']).toBe('nosniff');
    expect(dev['Strict-Transport-Security']).toBeUndefined();
    expect(securityHeaders('production')['Strict-Transport-Security']).toContain('max-age=63072000');
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
    ['/', false],
    ['/services', false],
    ['/insights/payments', false],
    ['/administration', false],
  ])('isPrivatePath(%s) = %s', (p, expected) => {
    expect(isPrivatePath(p)).toBe(expected);
  });
});
