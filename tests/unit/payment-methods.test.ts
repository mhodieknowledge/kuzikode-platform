import { describe, expect, it } from 'vitest';
import { normalizeZimPhone } from '../../src/shared/payment-methods';

describe('normalizeZimPhone', () => {
  it.each([
    ['0771234567', '0771234567'],
    ['077 123 4567', '0771234567'],
    ['+263 77 123 4567', '0771234567'],
    ['263771234567', '0771234567'],
    ['(078) 123-4567', '0781234567'],
  ])('%s → %s', (input, out) => expect(normalizeZimPhone(input)).toBe(out));

  it.each(['', '12345', '0241234567', '+27821234567', '07712345678', 'abc'])('rejects %s', (input) =>
    expect(normalizeZimPhone(input)).toBeNull(),
  );
});
