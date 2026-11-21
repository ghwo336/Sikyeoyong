import { describe, expect, it } from 'vitest';
import { HATCH_MAX_FAILURES, HATCH_POLL_MS, hatchPollInterval } from './hatch';

describe('hatchPollInterval', () => {
  it('asks every second while the dragon is hatching', () => {
    expect(hatchPollInterval('PENDING')).toBe(HATCH_POLL_MS);
    expect(HATCH_POLL_MS).toBe(1_000);
  });

  it('does not poll before the first answer or after a failed first GET (QA 6 H2)', () => {
    expect(hatchPollInterval(undefined)).toBe(false);
    expect(hatchPollInterval(undefined, HATCH_MAX_FAILURES)).toBe(false);
  });

  it('stops polling a PENDING dragon once its reads gave up', () => {
    expect(hatchPollInterval('PENDING', 1)).toBe(HATCH_POLL_MS);
    expect(hatchPollInterval('PENDING', HATCH_MAX_FAILURES)).toBe(false);
  });

  it('stops once the dragon is up (the screen moves on to /budget)', () => {
    expect(hatchPollInterval('ACTIVE')).toBe(false);
  });

  it('stops when setup failed (only "다시 깨우기" starts it again)', () => {
    expect(hatchPollInterval('FAILED')).toBe(false);
  });
});
