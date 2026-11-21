import type { AgentSetupView } from '../../lib/api';

/** How often the hatch screen asks again while the dragon is still hatching. */
export const HATCH_POLL_MS = 1_000;

/** Reads in a row that fail before a PENDING dragon is no longer asked every second. */
export const HATCH_MAX_FAILURES = 4;

/**
 * The polling rule for setup (web.md "부화 다시 받기"). Ask every second only while it is PENDING.
 * Not known yet is the first read still on its way (or failed: then a retry line, not a tight
 * loop, QA 6 H2); ACTIVE ends it (the screen moves on) and FAILED waits for "다시 깨우기".
 * `failures`: reads in a row that failed (each failed poll counts its own retry too). A PENDING
 * dragon whose reads keep failing is not asked every second forever either (HATCH_MAX_FAILURES);
 * a failed poll or two still goes on, and the screen's retry line asks again after that.
 */
export function hatchPollInterval(
  status: AgentSetupView['status'] | undefined,
  failures = 0,
): number | false {
  return status === 'PENDING' && failures < HATCH_MAX_FAILURES ? HATCH_POLL_MS : false;
}
