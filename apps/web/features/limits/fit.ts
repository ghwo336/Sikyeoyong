import { getPolicy, perOrderLimitToFit } from '@sikyeoyong/shared';

/**
 * The smallest per-order limit that lets this order through (Blocked.dc.html "한 번에 N원으로
 * 올리고 시키기", D-31), or undefined above the top of the range. The per-order range is the same
 * in every profile (policy.test.ts), so the default profile answers for the demo too.
 */
export function limitToFit(amount: bigint): bigint | undefined {
  return perOrderLimitToFit(getPolicy('default'), amount) ?? undefined;
}
