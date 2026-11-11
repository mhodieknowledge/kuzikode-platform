import { describe, expect, it } from 'vitest';
import { decimalToMinor, minorToDecimal, parseDecimalMinor } from '../src/money';

describe('money conversions (integer only)', () => {
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [29, '0.29'],
    [1234, '12.34'],
    [100000, '1000.00'],
    [-5, '-0.05'],
  ])('minorToDecimal(%i) = %s', (minor, s) => {
    expect(minorToDecimal(minor)).toBe(s);
    expect(decimalToMinor(s)).toBe(minor);
  });

  it('handles other minor-unit digits', () => {
    expect(minorToDecimal(1234, 0)).toBe('1234');
    expect(minorToDecimal(1234, 3)).toBe('1.234');
    expect(decimalToMinor('1.234', 3)).toBe(1234);
  });

  it('parses gateway decimals strictly', () => {
    expect(decimalToMinor('12')).toBe(1200);
    expect(decimalToMinor('12.3')).toBe(1230);
    expect(decimalToMinor('12.340')).toBe(1234);
    expect(decimalToMinor(' 99.99 ')).toBe(9999);
    for (const bad of ['12.345', '1,000.00', '$12', '1e3', '', '.5', '12.', '--1', 'NaN', '0x10']) {
      expect(decimalToMinor(bad), bad).toBeNull();
    }
    expect(() => parseDecimalMinor('abc')).toThrow(RangeError);
  });

  it('refuses non-integers and unsafe numbers', () => {
    expect(() => minorToDecimal(12.5)).toThrow(RangeError);
    expect(() => minorToDecimal(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(decimalToMinor('999999999999999.99')).toBeNull();
  });
});
