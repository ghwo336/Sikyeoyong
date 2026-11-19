import { AppError, NETWORKS } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig, type RawEnv } from './env.js';

// verify-allow: R4 independent oracle for expected values, not production code
const OKRW = 10n ** 18n;

const PROD: RawEnv = {
  NODE_ENV: 'production',
  SESSION_SECRET: 'x'.repeat(32),
  ANTHROPIC_API_KEY: 'test-key',
  LLM_MODEL: 'test-model',
  OPERATOR_KEY: 'test-operator',
  ORDERS_CONTRACT: '0xcontract',
  AGENT_KEY_ENCRYPTION_KEY: 'test-enc',
};

function codeAndVars(fn: () => unknown): { code: string; variables: unknown } {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    const err = e as AppError;
    return { code: err.code, variables: (err.detail as { variables?: unknown }).variables };
  }
  throw new Error('expected loadConfig to throw');
}

describe('loadConfig defaults (tech-spec 8.3)', () => {
  const c = loadConfig({});

  it('uses development defaults with an empty environment', () => {
    expect(c.nodeEnv).toBe('development');
    expect(c.port).toBe(8787);
    expect(c.demo).toEqual({ enabled: false, bypassServerLimit: false });
    expect(c.payment).toEqual({
      path: 'B',
      floatMultiplier: 2n,
      submittingAlertMs: 600_000,
      confirmations: 1,
    });
    expect(c.llm.weatherProvider).toBe('static');
  });

  it('resolves chain and policy through shared config', () => {
    expect(c.chain.chainId).toBe(NETWORKS['maroo-testnet'].chainId);
    expect(c.chain.okrwDenom).toBe('atokrw');
    expect(c.policy.profile).toBe('default');
    expect(c.policy.perOrderLimitAokrw[1]).toBe(10_000n * OKRW);
  });
});

describe('loadConfig overrides', () => {
  it('reads every overridable value', () => {
    const c = loadConfig({
      PORT: '9000',
      CHAIN_ID: '777',
      MAROO_RPC_URL: 'http://localhost:8545',
      OKRW_DENOM: 'aokrw',
      POLICY_PROFILE: 'demo',
      PAYMENT_PATH: 'A',
      AGENT_FLOAT_MULTIPLIER: '3',
      SUBMITTING_ALERT_MS: '120000',
      DEMO_MODE: 'true',
      DEMO_BYPASS_SERVER_LIMIT: 'true',
      WEATHER_PROVIDER: 'openmeteo',
    });
    expect(c.port).toBe(9000);
    expect(c.chain.chainId).toBe(777);
    expect(c.chain.rpcUrl).toBe('http://localhost:8545');
    expect(c.chain.okrwDenom).toBe('aokrw');
    expect(c.policy.periodicCapAokrw).toBe(60_000n * OKRW);
    expect(c.payment.path).toBe('A');
    expect(c.payment.floatMultiplier).toBe(3n);
    expect(c.payment.submittingAlertMs).toBe(120_000);
    expect(c.demo).toEqual({ enabled: true, bypassServerLimit: true });
  });

  it('treats empty values as not set (.env.example style)', () => {
    const c = loadConfig({ ORDERS_DEPLOY_BLOCK: '', SESSION_SECRET: '   ', CHAIN_ID: '' });
    expect(c.chain.chainId).toBe(NETWORKS['maroo-testnet'].chainId);
    expect(c.secrets.sessionSecret).toBeUndefined();
  });
});

describe('loadConfig rejects bad values without leaking them', () => {
  it.each([
    ['PORT', 'abc'],
    ['PORT', '0'],
    ['PORT', '8787.5'],
    ['PORT', '65536'],
    ['CHAIN_ID', '-1'],
    ['DEMO_MODE', 'yes'],
    ['PAYMENT_PATH', 'D'],
    ['AGENT_FLOAT_MULTIPLIER', '0'],
    ['NODE_ENV', 'staging'],
    ['POLICY_PROFILE', 'prod'],
    ['OKRW_DENOM', 'X'],
    ['MAROO_RPC_URL', 'http://'],
  ])('%s=%s', (name, value) => {
    const r = codeAndVars(() => loadConfig({ [name]: value }));
    expect(r.code).toBe('INTERNAL');
    if (value.length > 3) expect(JSON.stringify(r)).not.toContain(value);
  });

  it('names the variable, never the secret value', () => {
    const secret = 'super-secret-token-value';
    const r = codeAndVars(() => loadConfig({ ...PROD, SESSION_SECRET: secret.slice(0, 10) }));
    expect(r.variables).toEqual(['SESSION_SECRET']);
    expect(JSON.stringify(r)).not.toContain(secret.slice(0, 10));
  });

  it('refuses DEMO_BYPASS_SERVER_LIMIT without DEMO_MODE', () => {
    expect(codeAndVars(() => loadConfig({ DEMO_BYPASS_SERVER_LIMIT: 'true' })).code).toBe(
      'INTERNAL',
    );
  });
});

describe('loadConfig in production', () => {
  it('accepts a complete path B environment', () => {
    expect(loadConfig(PROD).nodeEnv).toBe('production');
  });

  // Expected values written by hand from decisions D-05: path B signs with a server-held agent
  // key, paths A and C go through MAWS.
  it.each([
    ['A', 'WAAS_AUTH_TOKEN'],
    ['B', 'AGENT_KEY_ENCRYPTION_KEY'],
    ['C', 'WAAS_AUTH_TOKEN'],
  ] as const)('path %s requires %s', (path, required) => {
    const env = {
      ...PROD,
      PAYMENT_PATH: path,
      WAAS_AUTH_TOKEN: 'test-waas',
      AGENT_KEY_ENCRYPTION_KEY: 'test-enc',
      [required]: undefined,
    };
    expect(codeAndVars(() => loadConfig(env)).variables).toEqual([required]);
  });

  it.each(['A', 'C'] as const)('path %s does not need the agent key', (path) => {
    const env = {
      ...PROD,
      PAYMENT_PATH: path,
      WAAS_AUTH_TOKEN: 'test-waas',
      AGENT_KEY_ENCRYPTION_KEY: undefined,
    };
    expect(loadConfig(env).payment.path).toBe(path);
  });

  it('path B does not need the MAWS token', () => {
    expect(loadConfig({ ...PROD, WAAS_AUTH_TOKEN: undefined }).payment.path).toBe('B');
  });

  it.each(['SESSION_SECRET', 'ANTHROPIC_API_KEY', 'LLM_MODEL', 'OPERATOR_KEY', 'ORDERS_CONTRACT'])(
    'requires %s',
    (name) => {
      const r = codeAndVars(() => loadConfig({ ...PROD, [name]: undefined }));
      expect(r.variables).toEqual([name]);
    },
  );

  it('never allows the demo server-limit bypass', () => {
    const r = codeAndVars(() =>
      loadConfig({ ...PROD, DEMO_MODE: 'true', DEMO_BYPASS_SERVER_LIMIT: 'true' }),
    );
    expect(r.variables).toEqual(['DEMO_BYPASS_SERVER_LIMIT (production에서 금지)']);
  });
});
