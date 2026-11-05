import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('API error handling and headers', () => {
  it('returns a safe JSON 404 with request id', async () => {
    const res = await exports.default.fetch('http://localhost/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string }; requestId: string };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.requestId).toMatch(/^req_/);
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('sets security and no-store headers on API responses', async () => {
    const res = await exports.default.fetch('http://localhost/api/health');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('honours a well-formed incoming request id and ignores a malformed one', async () => {
    const ok = await exports.default.fetch('http://localhost/api/health', {
      headers: { 'x-request-id': 'abc12345-trace' },
    });
    expect(ok.headers.get('x-request-id')).toBe('abc12345-trace');
    const bad = await exports.default.fetch('http://localhost/api/health', { headers: { 'x-request-id': '<script>' } });
    expect(bad.headers.get('x-request-id')).toMatch(/^req_/);
  });
});
