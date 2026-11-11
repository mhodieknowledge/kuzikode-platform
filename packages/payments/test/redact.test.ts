import { describe, expect, it } from 'vitest';
import { formToObject, maskEmail, maskPhone, redact } from '../src/redact';

describe('redact', () => {
  it('drops secrets and masks personal data (docs/06 §7)', () => {
    const out = redact({
      status: 'Paid',
      reference: 'pat_1',
      hash: 'ABCDEF',
      token: '{11111111-1111}',
      integrationKey: 'k-123',
      Authorization: 'secret-key',
      phone: '0771234567',
      authemail: 'owner@kuzikode.example',
      paymentinstrument: '411111******1234',
      nested: { merchant_secret: 'zzz', authphone: '+263 77 123 4567', ok: 1 },
      list: [{ token: 't', status: 'x' }],
    });
    expect(out).toEqual({
      status: 'Paid',
      reference: 'pat_1',
      phone: '*******567',
      authemail: 'o***@kuzikode.example',
      paymentinstrument: '***1234',
      nested: { authphone: '*********567', ok: 1 },
      list: [{ status: 'x' }],
    });
  });

  it('scrubs secret values wherever they appear', () => {
    const out = redact({ pollurl: 'https://gw.example/poll?id=SECRET-ID-99&x=1' }, ['SECRET-ID-99']);
    expect(JSON.stringify(out)).not.toContain('SECRET-ID-99');
    expect(out['pollurl']).toBe('https://gw.example/poll?id=[redacted]&x=1');
  });

  it('masks helpers and parses form bodies', () => {
    expect(maskPhone('12')).toBe('***');
    expect(maskEmail('nope')).toBe('***');
    expect(formToObject('status=Ok&browserurl=https%3A%2F%2Fx.example%2Fa%3Fb%3D1')).toEqual({
      status: 'Ok',
      browserurl: 'https://x.example/a?b=1',
    });
  });
});
