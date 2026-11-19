import { z } from 'zod';
import { AppError } from '../errors/index.js';

/**
 * Money is always bigint aokrw (10^18 aokrw = 1 OKRW = 1 won on screen).
 * JSON and DB carry it as a decimal integer string. Never a JS number
 * (CLAUDE.md rule 4, tech-spec 5.4, data.md).
 */
export const AOKRW_PER_OKRW = 10n ** 18n;

/** Largest value a uint256 (contract amount) can hold. */
export const MAX_AOKRW = 2n ** 256n - 1n;

const AOKRW_STRING_RE = /^(0|[1-9][0-9]*)$/;
// Length check first so absurdly long strings never reach the regex or BigInt.
// Performance guard only: the BigInt comparison below gives the same answer.
const MAX_AOKRW_DIGITS = MAX_AOKRW.toString().length;

function assertAokrwRange(value: bigint): void {
  if (value < 0n || value > MAX_AOKRW) {
    throw new AppError('VALIDATION_FAILED', {
      reason: 'aokrw out of range',
      value: value.toString(),
    });
  }
}

function isAokrwString(value: string): boolean {
  return (
    value.length <= MAX_AOKRW_DIGITS && AOKRW_STRING_RE.test(value) && BigInt(value) <= MAX_AOKRW
  );
}

/** Parse an aokrw integer string from JSON, DB or chain. Rejects signs, decimals, spaces, leading zeros. */
export function parseAokrw(value: string): bigint {
  if (!isAokrwString(value)) {
    throw new AppError('VALIDATION_FAILED', {
      reason: 'invalid aokrw string',
      value: value.slice(0, 100),
    });
  }
  return BigInt(value);
}

/** Serialize aokrw for JSON and DB. */
export function aokrwToString(value: bigint): string {
  assertAokrwRange(value);
  return value.toString();
}

/** Whole OKRW (won) to aokrw. Seeds and policy values are written in whole won. */
export function okrwToAokrw(won: bigint): bigint {
  const aokrw = won * AOKRW_PER_OKRW;
  assertAokrwRange(aokrw);
  return aokrw;
}

const GROUPING = /\B(?=(\d{3})+(?!\d))/g;

/**
 * The one display format: "9,000원". Fractions of a won are cut off toward
 * zero (screens never show sub-won amounts). Negative values get a leading "-".
 * Rules: docs/wiki/conventions/code-style.md (money).
 */
export function formatOkrw(aokrw: bigint): string {
  if (aokrw > MAX_AOKRW || aokrw < -MAX_AOKRW) {
    throw new AppError('INTERNAL', { reason: 'aokrw out of display range' });
  }
  const negative = aokrw < 0n;
  const won = (negative ? -aokrw : aokrw) / AOKRW_PER_OKRW;
  const digits = won.toString().replace(GROUPING, ',');
  return `${negative && won > 0n ? '-' : ''}${digits}원`;
}

/** zod schema for aokrw strings in API bodies and responses. */
export const zAokrwString = z.string().refine(isAokrwString, {
  message: 'aokrw 정수 문자열이어야 한다 (0 이상, uint256 이하, 앞자리 0 없음)',
});
