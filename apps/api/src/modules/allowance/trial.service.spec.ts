import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config/env.js';
import type { IdentityService } from '../identity/identity.service.js';
import type { AllowanceService } from './allowance.service.js';
import { TrialService } from './trial.service.js';

const config = loadConfig({});

function make(verified: boolean, recorded: boolean) {
  const record = vi.fn(() => recorded);
  const allowance = { record } as unknown as AllowanceService;
  const identity = { isVerified: () => verified } as unknown as IdentityService;
  return { s: new TrialService(config, allowance, identity), record };
}

describe('TrialService.claim', () => {
  it('records the policy amount (100,000 won by default) for a verified owner', () => {
    const { s, record } = make(true, true);
    expect(s.claim('u1', 42)).toEqual({ granted: true });
    expect(record).toHaveBeenCalledWith('u1', 'trial', okrwToAokrw(100_000n), null, 42);
  });

  it('says granted false when the ledger already has the trial', () => {
    expect(make(true, false).s.claim('u1')).toEqual({ granted: false });
  });

  it('refuses an owner without the identity check and records nothing', () => {
    const { s, record } = make(false, true);
    expect(() => s.claim('u1')).toThrow(AppError);
    expect(record).not.toHaveBeenCalled();
  });
});
