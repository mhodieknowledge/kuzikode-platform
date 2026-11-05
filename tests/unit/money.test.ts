import { describe, expect, it } from 'vitest';
import {
  addMoney,
  allocateProportionally,
  decimalStringToMinor,
  formatBpAsPercent,
  formatMoney,
  formatQuantity,
  minorToDecimalString,
  money,
  MoneyError,
  mulDivHalfEven,
  parsePercentToBp,
  parseQuantityMilli,
  sumMoney,
} from '../../src/server/lib/money';

describe('minor unit conversion', () => {
  it.each([
    [0, 2, '0.00'],
    [5, 2, '0.05'],
    [1234, 2, '12.34'],
    [-5, 2, '-0.05'],
    [100000, 2, '1000.00'],
    [7, 0, '7'],
    [1500, 3, '1.500'],
  ])('minorToDecimalString(%i, %i) = %s', (m, d, s) => expect(minorToDecimalString(m, d)).toBe(s));

  it.each([
    ['12.34', 2, 1234],
    ['1,234.5', 2, 123450],
    ['0.05', 2, 5],
    ['.5', 2, 50],
    ['7', 0, 7],
    ['-3', 2, -300],
    [' 99.99 ', 2, 9999],
  ])('decimalStringToMinor(%s, %i) = %i', (s, d, m) => expect(decimalStringToMinor(s, d)).toBe(m));

  it('rejects extra decimals, floats-in-disguise and junk', () => {
    expect(() => decimalStringToMinor('1.234', 2)).toThrow(MoneyError);
    expect(() => decimalStringToMinor('1.5', 0)).toThrow(MoneyError);
    expect(() => decimalStringToMinor('1e3', 2)).toThrow(MoneyError);
    expect(() => decimalStringToMinor('$5', 2)).toThrow(MoneyError);
    expect(() => decimalStringToMinor('', 2)).toThrow(MoneyError);
  });

  it('round-trips without floating point drift', () => {
    for (const s of ['0.10', '0.20', '0.30', '19.99', '1000000.01']) {
      expect(minorToDecimalString(decimalStringToMinor(s, 2), 2)).toBe(s);
    }
  });
});

describe('mulDivHalfEven', () => {
  it.each([
    [1500, 333, 1000, 500], // 499.5 → 500 (even)
    [2500, 1, 1000, 2], // 2.5 → 2 (even)
    [3500, 1, 1000, 4], // 3.5 → 4 (even)
    [1, 1, 1000, 0],
    [1499, 1000, 1000, 1499],
    [-2500, 1, 1000, -2], // symmetric for negatives
    [1, 500, 1000, 0], // 0.5 → 0
    [3, 500, 1000, 2], // 1.5 → 2
  ])('round_half_even(%i × %i / %i) = %i', (a, b, d, r) => expect(mulDivHalfEven(a, b, d)).toBe(r));

  it('stays exact for large values and throws past 2^53', () => {
    expect(mulDivHalfEven(9_000_000_000_000, 1000, 1000)).toBe(9_000_000_000_000);
    expect(() => mulDivHalfEven(Number.MAX_SAFE_INTEGER, 2, 1)).toThrow(MoneyError);
    expect(() => mulDivHalfEven(1.5, 2, 1)).toThrow(MoneyError);
  });
});

describe('Money helpers', () => {
  it('adds and sums one currency', () => {
    expect(addMoney(money(100, 'USD'), money(250, 'USD'))).toEqual({ amountMinor: 350, currency: 'USD' });
    expect(sumMoney([money(1, 'ZWG'), money(2, 'ZWG')], 'ZWG').amountMinor).toBe(3);
  });

  it('throws on currency mismatch', () => {
    expect(() => addMoney(money(1, 'USD'), money(1, 'ZWG'))).toThrow(/Currency mismatch/);
    expect(() => sumMoney([money(1, 'USD'), money(1, 'ZWG')], 'USD')).toThrow(/Currency mismatch/);
  });

  it('rejects non-integer amounts', () => {
    expect(() => money(10.5, 'USD')).toThrow(MoneyError);
  });
});

describe('allocateProportionally', () => {
  it('always sums to the total', () => {
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportionally(10, [70, 30])).toEqual([7, 3]);
    expect(allocateProportionally(1, [1, 1])).toEqual([1, 0]);
    expect(allocateProportionally(0, [5, 5])).toEqual([0, 0]);
    expect(allocateProportionally(7, [0, 0])).toEqual([7, 0]);
    const parts = allocateProportionally(99_999, [3, 7, 11, 13, 17]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(99_999);
  });

  it('rejects negatives', () => {
    expect(() => allocateProportionally(-1, [1])).toThrow(MoneyError);
    expect(() => allocateProportionally(1, [-1])).toThrow(MoneyError);
  });
});

describe('parsing and formatting helpers', () => {
  it('parses quantities and percentages', () => {
    expect(parseQuantityMilli('1.5')).toBe(1500);
    expect(parseQuantityMilli('3')).toBe(3000);
    expect(() => parseQuantityMilli('0')).toThrow(MoneyError);
    expect(() => parseQuantityMilli('1.2345')).toThrow(MoneyError);
    expect(formatQuantity(1500)).toBe('1.5');
    expect(formatQuantity(3000)).toBe('3');
    expect(parsePercentToBp('15.5')).toBe(1550);
    expect(() => parsePercentToBp('101')).toThrow(MoneyError);
    expect(formatBpAsPercent(1550)).toBe('15.5%');
    expect(formatBpAsPercent(1000)).toBe('10%');
  });

  it('formats money for display', () => {
    expect(formatMoney(125000, 'USD')).toBe('$1,250.00');
    expect(formatMoney(30000, 'ZWG')).toBe('ZWG 300.00');
    expect(formatMoney(-500, 'USD')).toBe('-$5.00');
    expect(formatMoney(123456789, 'USD')).toBe('$1,234,567.89');
  });
});
