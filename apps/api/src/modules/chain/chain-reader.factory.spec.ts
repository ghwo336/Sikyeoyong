import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { createChainReader } from './chain-reader.factory.js';

const PROD = {
  NODE_ENV: 'production',
  SESSION_SECRET: 'x'.repeat(32),
  ANTHROPIC_API_KEY: 'k',
  LLM_MODEL: 'm',
  OPERATOR_KEY: 'o',
  ORDERS_CONTRACT: '0xcontract',
  AGENT_KEY_ENCRYPTION_KEY: 'e',
};

describe('createChainReader', () => {
  it.each(['development', 'test'] as const)('%s reads an empty window', async (NODE_ENV) => {
    const r = createChainReader(loadConfig({ NODE_ENV }));
    await expect(r.periodicVolume('0x0000000000000000000000000000000000000001')).resolves.toEqual({
      usedAokrw: 0n,
      resetAtSec: null,
    });
  });

  it('production never makes up a chain figure before the real reader exists', async () => {
    const r = createChainReader(loadConfig(PROD));
    const err = await r.periodicVolume(null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INTERNAL');
  });
});
