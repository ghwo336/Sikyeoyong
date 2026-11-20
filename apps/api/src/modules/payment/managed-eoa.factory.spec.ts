import { randomBytes } from 'node:crypto';
import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../config/env.js';
import type { SealedKeyRow } from './agent-key-vault.js';
import { operatorAccountOf } from './managed-eoa.factory.js';
import { createPaymentProvider } from './payment.service.js';

const store = {
  insert: (_row: SealedKeyRow) => undefined,
  find: (_address: string) => undefined,
  link: (_address: string, _agentId: string) => undefined,
};
const KEY = `0x${randomBytes(32).toString('hex')}`;
const ENV = {
  PAYMENT_PATH: 'B',
  POLICY_PROFILE: 'demo',
  OPERATOR_KEY: KEY,
  AGENT_KEY_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};

const WALLET = {
  agentRowId: '',
  address: '0x0000000000000000000000000000000000000001',
  ownerAddress: '0x0000000000000000000000000000000000000002',
} as const;
const PROD = {
  NODE_ENV: 'production',
  REAUTH_MODE: 'pouch',
  POUCHI_API_URL: 'https://pouchi.example',
  POUCHI_TENANT_ID: 'tenant_test',
  POUCHI_APP_KEY: 'test-app-key',
  POUCHI_APP_ID: 'app-test',
  SESSION_SECRET: 'x'.repeat(32),
  ANTHROPIC_API_KEY: 'k',
  LLM_MODEL: 'm',
  ORDERS_CONTRACT: '0x36713c60A8b4E54b56997553aD4b8b16d7C02Db8',
};

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
}

describe('operatorAccountOf', () => {
  it('accepts 32 byte hex with or without 0x', () => {
    expect(operatorAccountOf(KEY).address).toBe(operatorAccountOf(KEY.slice(2)).address);
  });

  it.each([undefined, '', 'nope', `0x${'1'.repeat(63)}`])(
    'refuses %j without echoing it',
    (raw) => {
      const err = thrown(() => operatorAccountOf(raw));
      expect(err).toBeInstanceOf(AppError);
      if (raw) expect(JSON.stringify((err as AppError).detail)).not.toContain(raw);
    },
  );
});

describe('createPaymentProvider for path B', () => {
  it('builds the managed EOA provider on the demo deployment (no network at construction)', () => {
    const p = createPaymentProvider(loadConfig(ENV), store);
    expect(p.path).toBe('B');
    expect(p.gasReserveAokrw).toBe(okrwToAokrw(2_000n));
  });

  it('AGENT_GAS_SHARE_OKRW sets the gas reserve', () => {
    const p = createPaymentProvider(loadConfig({ ...ENV, AGENT_GAS_SHARE_OKRW: '10' }), store);
    expect(p.gasReserveAokrw).toBe(okrwToAokrw(10n));
  });

  it('outside production a missing piece leaves a provider that pays nothing', async () => {
    for (const config of [
      loadConfig({ ...ENV, OPERATOR_KEY: '' }),
      loadConfig({ ...ENV, AGENT_KEY_ENCRYPTION_KEY: '' }),
      loadConfig({ ...ENV, POLICY_PROFILE: 'default' }),
    ]) {
      const p = createPaymentProvider(config, store);
      expect(p.path).toBe('B');
      await expect(
        p.balanceOf('0x0000000000000000000000000000000000000001'),
      ).rejects.toBeInstanceOf(AppError);
    }
    const noStore = createPaymentProvider(loadConfig(ENV));
    await expect(noStore.fund(WALLET, 1n)).rejects.toBeInstanceOf(AppError);
  });

  it('in production a missing piece stops the boot instead of starting unsafe', () => {
    const prod = { ...PROD, ...ENV };
    expect(thrown(() => createPaymentProvider(loadConfig(prod), store))).toBeNull();
    // An unusable ORDERS_CONTRACT.
    expect(
      thrown(() =>
        createPaymentProvider(loadConfig({ ...prod, ORDERS_CONTRACT: '0xnothex' }), store),
      ),
    ).toBeInstanceOf(AppError);
    expect(thrown(() => createPaymentProvider(loadConfig(prod)))).toBeInstanceOf(AppError);
  });

  it('paths A and C still pay nothing: every call is INTERNAL', async () => {
    const p = createPaymentProvider(loadConfig({ PAYMENT_PATH: 'C' }), store);
    await expect(p.balanceOf('0x0000000000000000000000000000000000000001')).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
