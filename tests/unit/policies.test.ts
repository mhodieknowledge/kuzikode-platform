import { describe, expect, it } from 'vitest';
import { clientScope } from '../../src/server/lib/policies';

describe('clientScope', () => {
  it('builds a bound IN list', () => {
    expect(clientScope('i.client_id', ['a', 'b'])).toEqual({ sql: 'i.client_id IN (?, ?)', params: ['a', 'b'] });
  });
  it('matches nothing for an empty scope', () => {
    expect(clientScope('client_id', [])).toEqual({ sql: '1 = 0', params: [] });
  });
  it('rejects unsafe column names', () => {
    expect(() => clientScope('client_id; DROP TABLE x', ['a'])).toThrow();
  });
});
