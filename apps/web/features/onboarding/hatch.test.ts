import { describe, expect, it } from 'vitest';
import { HATCH_POLL_MS, hatchPollInterval } from './hatch';

describe('hatchPollInterval', () => {
  it('asks every second while the dragon is hatching', () => {
    expect(hatchPollInterval('PENDING')).toBe(HATCH_POLL_MS);
    expect(HATCH_POLL_MS).toBe(1_000);
  });

  it('keeps asking before the first answer, and after a failed GET with nothing known yet', () => {
    expect(hatchPollInterval(undefined)).toBe(HATCH_POLL_MS);
  });

  it('stops once the dragon is up (the screen moves on to /budget)', () => {
    expect(hatchPollInterval('ACTIVE')).toBe(false);
  });

  it('stops when setup failed (only "다시 깨우기" starts it again)', () => {
    expect(hatchPollInterval('FAILED')).toBe(false);
  });
});
