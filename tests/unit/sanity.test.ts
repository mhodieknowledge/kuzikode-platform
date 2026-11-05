import { describe, expect, it } from 'vitest';
import { API_PREFIX } from '../../src/server/worker-factory';

describe('worker factory', () => {
  it('uses /api/ as the API prefix', () => {
    expect(API_PREFIX).toBe('/api/');
  });
});
