import { okrwToAokrw } from '@sikyeoyong/shared';

/** The default per-order limit of the run in whole OKRW (the original fixed amounts). */
export const DEFAULT_LIMIT_WON = 10_000n;
/** Below this the percent steps would round to nothing. */
const MIN_LIMIT_WON = 100n;

export interface E2eAmounts {
  readonly limit: bigint;
  /** Agent float: limit + 5% (one order at 90%, the refused order, and gas). */
  readonly fund: bigint;
  /** Order A, which passes: 90% of the limit. */
  readonly orderA: bigint;
  /** The tightened per-order limit for the refusal step: 5% of the limit. */
  readonly tightLimit: bigint;
  /** The refused order: 10% of the limit, above the tightened limit. */
  readonly refusal: bigint;
  /** The preflight while frozen: 4% of the limit, under the tightened limit. */
  readonly frozenProbe: bigint;
}

/** Parses `--limit` (whole OKRW, digits only) with the default when absent. */
export function parseLimitWon(raw: string | undefined): bigint {
  if (raw === undefined) return DEFAULT_LIMIT_WON;
  if (!/^[1-9][0-9]{0,12}$/.test(raw)) {
    throw new Error(`--limit must be whole OKRW digits, got "${raw}"`);
  }
  const won = BigInt(raw);
  if (won < MIN_LIMIT_WON) throw new Error(`--limit must be at least ${String(MIN_LIMIT_WON)}`);
  return won;
}

/** Every amount of the run, in aokrw bigint, derived from one limit in whole OKRW. */
export function planAmounts(limitWon: bigint): E2eAmounts {
  const limit = okrwToAokrw(limitWon);
  return {
    limit,
    fund: limit + limit / 20n,
    orderA: (limit * 90n) / 100n,
    tightLimit: limit / 20n,
    refusal: limit / 10n,
    frozenProbe: (limit * 4n) / 100n,
  };
}
