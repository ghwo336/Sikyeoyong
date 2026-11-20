import { AppError, NETWORKS } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig, type RawEnv } from './env.js';

// verify-allow: R4 independent oracle for expected values, not production code
const OKRW = 10n ** 18n;

const PROD: RawEnv = {
  NODE_ENV: 'production',
  REAUTH_MODE: 'pouch',
  POUCHI_API_URL: 'https://pouchi.example',
  POUCHI_TENANT_ID: 'tenant_test',
  POUCHI_APP_KEY: 'test-app-key',
  POUCHI_APP_ID: 'app-test',
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
      ownerMode: 'custodial',
      floatMultiplier: 2n,
      submittingAlertMs: 600_000,
      confirmations: 1,
    });
    expect(c.llm.weatherProvider).toBe('static');
    expect(c.llm.weatherStatic).toBe('맑음');
    expect([c.llm.weatherLat, c.llm.weatherLon]).toEqual([37.4979, 127.0276]);
    expect(c.llm.effort).toBe('low'); // D-26
    expect(c.llm.mode).toBe('live');
    expect(c.llm.dailyTokenCap).toBe(1_000_000);
    expect(c.verifyMode).toBe('kakao');
    expect(c.policy.trialAllowanceAokrw).toBe(100_000n * OKRW);
  });

  it('resolves chain and policy through shared config', () => {
    expect(c.chain.chainId).toBe(NETWORKS['maroo-testnet'].chainId);
    expect(c.chain.okrwDenom).toBe('atokrw');
    expect(c.policy.profile).toBe('default');
    expect(c.policy.perOrderLimit.initialAokrw).toBe(10_000n * OKRW);
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
      LLM_EFFORT: 'low',
      VERIFY_MODE: 'mock',
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
    expect(c.llm.effort).toBe('low');
    expect(c.verifyMode).toBe('mock');
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
    ['VERIFY_MODE', 'sms'],
    ['OWNER_MODE', 'self'],
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

  it('never pays through the mock path', () => {
    const r = codeAndVars(() => loadConfig({ ...PROD, PAYMENT_PATH: 'mock' }));
    expect(r.variables).toEqual(['PAYMENT_PATH=mock (production에서 금지)']);
  });

  it('accepts the mock path outside production', () => {
    expect(loadConfig({ PAYMENT_PATH: 'mock' }).payment.path).toBe('mock');
  });

  it('never allows the demo server-limit bypass', () => {
    const r = codeAndVars(() =>
      loadConfig({ ...PROD, DEMO_MODE: 'true', DEMO_BYPASS_SERVER_LIMIT: 'true' }),
    );
    expect(r.variables).toEqual(['DEMO_BYPASS_SERVER_LIMIT (production에서 금지)']);
  });

  it('refuses DEV_LOGIN=true, and only that, when everything else is in place', () => {
    const r = codeAndVars(() => loadConfig({ ...PROD, DEV_LOGIN: 'true' }));
    expect(r.variables).toEqual(['DEV_LOGIN (production에서 금지)']);
    expect(loadConfig({ ...PROD, DEV_LOGIN: 'false' }).devLogin).toBe(false);
  });

  it('refuses REAUTH_MODE=none, the testnet-demo button-only raise (D-28)', () => {
    const r = codeAndVars(() => loadConfig({ ...PROD, REAUTH_MODE: 'none' }));
    expect(r.variables).toEqual(['REAUTH_MODE=none (production에서 금지)']);
    expect(loadConfig(PROD).reauthMode).toBe('pouch');
  });
});

describe('Pouchi login config (D-29)', () => {
  it('is off when POUCHI_API_URL is unset, and the app key never sits in the public part', () => {
    expect(loadConfig({}).pouchi).toBeUndefined();
    const c = loadConfig({
      POUCHI_API_URL: 'https://pouchi.example',
      POUCHI_TENANT_ID: 't1',
      POUCHI_APP_KEY: 'secret-key',
      POUCHI_APP_ID: 'app1',
    });
    expect(c.pouchi).toEqual({
      apiUrl: 'https://pouchi.example',
      tenantId: 't1',
      appId: 'app1',
      vaultUrl: 'https://auth.pouchi.io',
      bridgeIssuer: 'https://auth.pouchi.io',
      environment: 'sandbox',
    });
    expect(JSON.stringify(c.pouchi)).not.toContain('secret-key');
    expect(c.secrets.pouchiAppKey).toBe('secret-key');
  });

  it('a URL without the tenant, key or app id stops the server, naming variables only', () => {
    try {
      loadConfig({ POUCHI_API_URL: 'https://pouchi.example', POUCHI_APP_KEY: 'secret-key' });
      expect.unreachable();
    } catch (e) {
      expect(JSON.stringify((e as { detail: unknown }).detail)).not.toContain('secret-key');
      expect((e as { detail: { variables: string[] } }).detail.variables).toContain(
        'POUCHI_TENANT_ID',
      );
    }
  });

  it('production needs POUCHI_API_URL', () => {
    const { POUCHI_API_URL: _drop, ...rest } = PROD;
    expect(() => loadConfig(rest)).toThrow();
  });
});

describe('LLM_PROVIDER (D-30)', () => {
  it('defaults to anthropic; openai keeps its key in secrets only', () => {
    expect(loadConfig({}).llm.provider).toBe('anthropic');
    const c = loadConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-secret' });
    expect(c.llm.provider).toBe('openai');
    expect(c.secrets.openaiApiKey).toBe('sk-secret');
    expect(JSON.stringify(c.llm)).not.toContain('sk-secret');
  });

  it('production with openai needs OPENAI_API_KEY, not ANTHROPIC_API_KEY', () => {
    const { ANTHROPIC_API_KEY: _a, ...rest } = PROD;
    expect(() => loadConfig({ ...rest, LLM_PROVIDER: 'openai' })).toThrow();
    expect(() =>
      loadConfig({ ...rest, LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x' }),
    ).not.toThrow();
  });
});
