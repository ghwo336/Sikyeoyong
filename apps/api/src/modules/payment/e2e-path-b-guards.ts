import { formatOkrw, okrwToAokrw } from '@sikyeoyong/shared';

/**
 * Operator gas for the owner-side writes of one run (register, link, limit x2, bind, fund,
 * freeze x2: about 14 OKRW measured), with room.
 */
export const GAS_MARGIN_AOKRW = okrwToAokrw(25n);

/** Stops before any transaction when the operator cannot pay the float plus the gas. */
export function assertOperatorCovers(balance: bigint, fundAokrw: bigint): void {
  const needed = fundAokrw + GAS_MARGIN_AOKRW;
  if (balance < needed) {
    throw new Error(
      `operator balance ${formatOkrw(balance)} is below ${formatOkrw(needed)} (fund ${formatOkrw(fundAokrw)} + gas margin ${formatOkrw(GAS_MARGIN_AOKRW)}); nothing sent`,
    );
  }
}

/**
 * Runs the final drain without ever throwing, so a drain failure cannot replace the error that
 * stopped the run. A failure is reported on its own and gives false.
 */
export async function drainWithoutMasking(
  drain: () => Promise<void>,
  report: (line: string) => void,
): Promise<boolean> {
  try {
    await drain();
    return true;
  } catch (e) {
    report(`e2e drain failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    return false;
  }
}
