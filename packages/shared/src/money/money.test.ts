import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/index.js';
import {
  AOKRW_PER_OKRW,
  MAX_AOKRW,
  aokrwToString,
  formatOkrw,
  okrwToAokrw,
  parseAokrw,
  zAokrwString,
} from './money.js';

const ONE_OKRW = 1_000_000_000_000_000_000n;
const UINT256_MAX = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

describe('constants', () => {
  it('uses 18 decimals and the uint256 ceiling', () => {
    expect(AOKRW_PER_OKRW).toBe(ONE_OKRW);
    expect(MAX_AOKRW).toBe(UINT256_MAX);
  });
});

describe('parseAokrw', () => {
  it.each([
    ['0', 0n],
    ['1', 1n],
    ['9000000000000000000000', 9_000n * ONE_OKRW],
    ['1000000000000000000000000', 10n ** 24n],
    ['123456789012345678901234567890', 123456789012345678901234567890n],
    [UINT256_MAX.toString(), UINT256_MAX],
  ])('parses %s', (input, expected) => {
    expect(parseAokrw(input)).toBe(expected);
  });

  it.each([
    '',
    ' 1',
    '1 ',
    '-1',
    '+1',
    '01',
    '00',
    '1.0',
    '1.5',
    '1e3',
    '0x10',
    '1_000',
    '1,000',
    '١٢',
    'NaN',
    'Infinity',
    (UINT256_MAX + 1n).toString(),
    '9'.repeat(200),
    '9'.repeat(1_000_000),
    // Unicode digits must never pass the ASCII-only check (and must not reach BigInt).
    '０',
    '１２',
    '1０',
    '1٢',
    '٠',
    '𝟏',
    '१२',
    '1\n',
    '\n1',
    '1\0',
    '\u200b1',
    '-0',
  ])('rejects %j with VALIDATION_FAILED', (input) => {
    expect(() => parseAokrw(input)).toThrow(
      expect.objectContaining({ name: 'AppError', code: 'VALIDATION_FAILED' }),
    );
  });
});

describe('aokrwToString', () => {
  it('round trips without loss, including values above 10^24', () => {
    for (const v of [
      0n,
      1n,
      10n ** 24n,
      10n ** 24n + 7n,
      987654321n * ONE_OKRW + 1n,
      UINT256_MAX,
    ]) {
      expect(parseAokrw(aokrwToString(v))).toBe(v);
    }
  });

  it('rejects negative and overflowing values', () => {
    expect(() => aokrwToString(-1n)).toThrow(AppError);
    expect(() => aokrwToString(UINT256_MAX + 1n)).toThrow(AppError);
  });
});

describe('okrwToAokrw', () => {
  it('scales whole won by 10^18', () => {
    expect(okrwToAokrw(0n)).toBe(0n);
    expect(okrwToAokrw(1n)).toBe(ONE_OKRW);
    expect(okrwToAokrw(45_000n)).toBe(45_000_000_000_000_000_000_000n);
    expect(okrwToAokrw(500_000n)).toBe(500_000n * ONE_OKRW);
  });

  it('rejects negative won and overflow', () => {
    expect(() => okrwToAokrw(-1n)).toThrow(AppError);
    expect(() => okrwToAokrw(UINT256_MAX)).toThrow(AppError);
  });
});

describe('formatOkrw', () => {
  it.each([
    [0n, '0원'],
    [ONE_OKRW, '1원'],
    [999n * ONE_OKRW, '999원'],
    [1_000n * ONE_OKRW, '1,000원'],
    [9_000n * ONE_OKRW, '9,000원'],
    [45_000n * ONE_OKRW, '45,000원'],
    [1_234_567n * ONE_OKRW, '1,234,567원'],
    [10_000_000n * ONE_OKRW, '10,000,000원'],
    [10n ** 24n, '1,000,000원'],
  ])('formats %s', (aokrw, expected) => {
    expect(formatOkrw(aokrw)).toBe(expected);
  });

  it('cuts sub-won fractions toward zero', () => {
    expect(formatOkrw(ONE_OKRW - 1n)).toBe('0원');
    expect(formatOkrw(9_000n * ONE_OKRW + ONE_OKRW / 2n)).toBe('9,000원');
    expect(formatOkrw(1n)).toBe('0원');
  });

  it('prefixes negatives and never prints "-0원"', () => {
    expect(formatOkrw(-9_000n * ONE_OKRW)).toBe('-9,000원');
    expect(formatOkrw(-(ONE_OKRW - 1n))).toBe('0원');
  });

  it('refuses values outside the uint256 range instead of formatting them', () => {
    expect(() => formatOkrw(UINT256_MAX + 1n)).toThrow(AppError);
    expect(() => formatOkrw(-UINT256_MAX - 1n)).toThrow(AppError);
    expect(formatOkrw(-UINT256_MAX).startsWith('-')).toBe(true);
  });

  it('formats the largest amount exactly', () => {
    const won = (UINT256_MAX / ONE_OKRW).toString();
    expect(formatOkrw(UINT256_MAX).replace(/[,원]/g, '')).toBe(won);
  });
});

describe('zAokrwString', () => {
  it('accepts what parseAokrw accepts and rejects the rest', () => {
    expect(zAokrwString.safeParse('45000000000000000000000').success).toBe(true);
    expect(zAokrwString.safeParse(UINT256_MAX.toString()).success).toBe(true);
    for (const bad of ['', '-1', '01', '1.5', '１２', '1٢', (UINT256_MAX + 1n).toString()]) {
      expect(zAokrwString.safeParse(bad).success, bad).toBe(false);
    }
    expect(zAokrwString.safeParse(45000).success).toBe(false);
  });
});
