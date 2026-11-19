import type { AgentSetupView } from '../../lib/api';

/** How often the hatch screen asks again while the dragon is still hatching. */
export const HATCH_POLL_MS = 1_000;

/**
 * The polling rule for Hatch (web.md "부화 다시 받기"). Ask every second while setup is PENDING or
 * not known yet; stop once it is ACTIVE (the screen moves on) or FAILED (only "다시 깨우기" starts
 * it again). A failed GET keeps the last known status (TanStack Query keeps data on error), so an
 * error alone never stops it: the read is safe to repeat and there is no retry button to fall
 * back on while hatching.
 */
export function hatchPollInterval(status: AgentSetupView['status'] | undefined): number | false {
  return status === undefined || status === 'PENDING' ? HATCH_POLL_MS : false;
}
