import {
  AppError,
  getPolicy,
  isPolicyProfile,
  resolveChainConfig,
  type ChainConfig,
  type PolicyConfig,
} from '@sikyeoyong/shared';
import { z } from 'zod';

/** Claude effort levels (D-22). One list for the env schema and AppConfig. */
export const LLM_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type LlmEffort = (typeof LLM_EFFORTS)[number];

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const int = (min: number, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .regex(/^\d+$/, 'integer')
    .transform(Number)
    .refine((n) => Number.isSafeInteger(n) && n >= min && n <= max, `${min}..${max}`);
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v));

/**
 * Environment variables (tech-spec 8.3). Parsed once at boot; a bad value stops
 * the server. Secrets are optional in development and required in production.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(1, 65535).default(8787),
  PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
  SESSION_SECRET: optionalText,
  DATABASE_URL: z.string().min(1).default('file:./data/sikyeoyong.db'),
  DEMO_MODE: bool.default(false),
  DEMO_BYPASS_SERVER_LIMIT: bool.default(false),
  /** Local development only: POST /api/auth/dev-login without OAuth. Refused in production. */
  DEV_LOGIN: bool.default(false),
  /** D-28: none = testnet demo, a level raise by the button alone (refused in production); pouch = the owner's wallet signs (Q-30). */
  REAUTH_MODE: z.enum(['none', 'pouch']).default('none'),
  /** D-29: Pouchi login (the only login). Unset POUCHI_API_URL turns it off. */
  POUCHI_API_URL: z.url().optional(),
  POUCHI_TENANT_ID: optionalText,
  POUCHI_APP_KEY: optionalText,
  POUCHI_APP_ID: optionalText,
  POUCHI_VAULT_URL: z.url().default('https://auth.pouchi.io'),
  POUCHI_BRIDGE_ISSUER: z.url().default('https://auth.pouchi.io'),
  POUCHI_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  KAKAO_REST_API_KEY: optionalText,
  KAKAO_CLIENT_SECRET: optionalText,
  GOOGLE_CLIENT_ID_WEB: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  /** D-30: which company's model answers the chat. */
  LLM_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  OPENAI_API_KEY: optionalText,
  LLM_MODEL: optionalText,
  /** D-26: low by default for the demo (cost); raise it per run when a scene needs it. */
  LLM_EFFORT: z.enum(LLM_EFFORTS).default('low'),
  /** D-26: replay plays fixed dragon turns with the real tools, no API call; live calls Claude. */
  LLM_MODE: z.enum(['live', 'replay']).default('live'),
  /** D-26: live tokens (input, output and cache) per KST day; at it the dragon says it is tired for the rest of the day. 0 = no cap. */
  LLM_DAILY_TOKEN_CAP: int(0).default(1_000_000),
  WEATHER_PROVIDER: z.enum(['static', 'openmeteo']).default('static'),
  /** D-16: kakao now; mock when Maroo switches to Mock KYC. */
  VERIFY_MODE: z.enum(['kakao', 'mock']).default('kakao'),
  MAROO_RPC_URL: optionalText,
  CHAIN_ID: int(1).optional(),
  OKRW_DENOM: optionalText,
  ORDERS_CONTRACT: optionalText,
  ORDERS_DEPLOY_BLOCK: int(0).optional(),
  POLICY_PROFILE: z.string().default('default'),
  KYB_SCHEMA_UID: optionalText,
  OPERATOR_KEY: optionalText,
  CONFIRMATIONS: int(1).default(1),
  /** mock: in-memory chain for development and tests, refused in production. */
  PAYMENT_PATH: z.enum(['A', 'B', 'C', 'mock']).default('B'),
  /** D-24: custodial now (the operator owns agents); pouch once the Pouch embedded SDK ships. */
  OWNER_MODE: z.enum(['custodial', 'pouch']).default('custodial'),
  WAAS_AUTH_TOKEN: optionalText,
  AGENT_KEY_ENCRYPTION_KEY: optionalText,
  AGENT_FLOAT_MULTIPLIER: int(1).default(2),
  SUBMITTING_ALERT_MS: int(1000).default(600_000),
});

export type RawEnv = Readonly<Record<string, string | undefined>>;

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly publicBaseUrl: string;
  readonly databaseUrl: string;
  readonly demo: { readonly enabled: boolean; readonly bypassServerLimit: boolean };
  /** Identity step on sign-up (D-16). */
  readonly verifyMode: 'kakao' | 'mock';
  /** POST /api/auth/dev-login is open (never in production, auth.md). */
  readonly devLogin: boolean;
  /** D-28: how a level raise is re-authenticated. */
  readonly reauthMode: 'none' | 'pouch';
  readonly chain: ChainConfig;
  /**
   * D-29 Pouchi login. undefined when POUCHI_API_URL is unset (login refuses). The app key is
   * in secrets, never here: this part may go to the web as the login config.
   */
  readonly pouchi:
    | {
        readonly apiUrl: string;
        readonly tenantId: string;
        readonly appId: string;
        readonly vaultUrl: string;
        readonly bridgeIssuer: string;
        readonly environment: 'sandbox' | 'production';
      }
    | undefined;
  readonly policy: PolicyConfig;
  readonly payment: {
    readonly path: 'A' | 'B' | 'C' | 'mock';
    readonly ownerMode: 'custodial' | 'pouch';
    readonly floatMultiplier: bigint;
    readonly submittingAlertMs: number;
    readonly confirmations: number;
  };
  readonly llm: {
    readonly model: string | undefined;
    /** Claude effort for the chat agent (D-26: default low). */
    readonly effort: LlmEffort;
    /** D-26: live Claude, or replayed dragon turns (no API call). */
    /** D-30: anthropic (default) or openai. */
    readonly provider: 'anthropic' | 'openai';
    readonly mode: 'live' | 'replay';
    /** D-26: live tokens per KST day before the tired line; 0 = no cap. */
    readonly dailyTokenCap: number;
    readonly weatherProvider: 'static' | 'openmeteo';
  };
  /** Secrets stay here and are never logged (security.md). */
  readonly secrets: {
    readonly sessionSecret: string | undefined;
    readonly anthropicApiKey: string | undefined;
    readonly openaiApiKey: string | undefined;
    readonly pouchiAppKey: string | undefined;
    readonly operatorKey: string | undefined;
    readonly waasAuthToken: string | undefined;
    readonly agentKeyEncryptionKey: string | undefined;
    readonly kakaoRestApiKey: string | undefined;
    readonly kakaoClientSecret: string | undefined;
    readonly googleClientIdWeb: string | undefined;
    readonly googleClientSecret: string | undefined;
  };
}

function requireInProduction(env: z.infer<typeof schema>): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const missing: string[] = [];
  const need = (name: keyof typeof env, ok: boolean) => {
    if (!ok) missing.push(name);
  };
  need('SESSION_SECRET', (env.SESSION_SECRET?.length ?? 0) >= 32);
  if (env.LLM_PROVIDER === 'openai') need('OPENAI_API_KEY', env.OPENAI_API_KEY !== undefined);
  else need('ANTHROPIC_API_KEY', env.ANTHROPIC_API_KEY !== undefined);
  need('LLM_MODEL', env.LLM_MODEL !== undefined);
  need('OPERATOR_KEY', env.OPERATOR_KEY !== undefined);
  // Required now so a production boot cannot start without a deployed orders proxy; the chain
  // module commit moves the address into shared deployments resolution (CLAUDE.md 2).
  need('ORDERS_CONTRACT', env.ORDERS_CONTRACT !== undefined);
  if (env.PAYMENT_PATH === 'B')
    need('AGENT_KEY_ENCRYPTION_KEY', env.AGENT_KEY_ENCRYPTION_KEY !== undefined);
  if (env.PAYMENT_PATH === 'A' || env.PAYMENT_PATH === 'C')
    need('WAAS_AUTH_TOKEN', env.WAAS_AUTH_TOKEN !== undefined);
  if (env.PAYMENT_PATH === 'mock') missing.push('PAYMENT_PATH=mock (production에서 금지)');
  if (env.DEMO_BYPASS_SERVER_LIMIT) missing.push('DEMO_BYPASS_SERVER_LIMIT (production에서 금지)');
  if (env.DEV_LOGIN) missing.push('DEV_LOGIN (production에서 금지)');
  if (env.REAUTH_MODE === 'none') missing.push('REAUTH_MODE=none (production에서 금지)');
  need('POUCHI_API_URL', env.POUCHI_API_URL !== undefined);
  return missing;
}

/** Parse and check the environment. Throws AppError(INTERNAL) with the variable names only, never values. */
export function loadConfig(raw: RawEnv): AppConfig {
  // An empty value (`ORDERS_DEPLOY_BLOCK=` in .env.example) means "not set".
  const present = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const parsed = schema.safeParse(present);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))];
    throw new AppError('INTERNAL', { reason: 'invalid environment', variables: names });
  }
  const env = parsed.data;
  const missing = requireInProduction(env);
  if (missing.length > 0) {
    throw new AppError('INTERNAL', {
      reason: 'missing production environment',
      variables: missing,
    });
  }
  if (!isPolicyProfile(env.POLICY_PROFILE)) {
    throw new AppError('INTERNAL', {
      reason: 'invalid environment',
      variables: ['POLICY_PROFILE'],
    });
  }
  if (
    env.POUCHI_API_URL !== undefined &&
    (env.POUCHI_TENANT_ID === undefined ||
      env.POUCHI_APP_KEY === undefined ||
      env.POUCHI_APP_ID === undefined)
  ) {
    throw new AppError('INTERNAL', {
      reason: 'POUCHI_API_URL needs the tenant, app key and app id',
      variables: ['POUCHI_TENANT_ID', 'POUCHI_APP_KEY', 'POUCHI_APP_ID'],
    });
  }
  if (env.DEMO_BYPASS_SERVER_LIMIT && !env.DEMO_MODE) {
    throw new AppError('INTERNAL', {
      reason: 'DEMO_BYPASS_SERVER_LIMIT needs DEMO_MODE',
      variables: ['DEMO_BYPASS_SERVER_LIMIT'],
    });
  }
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    databaseUrl: env.DATABASE_URL,
    demo: { enabled: env.DEMO_MODE, bypassServerLimit: env.DEMO_BYPASS_SERVER_LIMIT },
    chain: resolveChainConfig('maroo-testnet', {
      chainId: env.CHAIN_ID,
      rpcUrl: env.MAROO_RPC_URL,
      okrwDenom: env.OKRW_DENOM,
    }),
    pouchi:
      env.POUCHI_API_URL === undefined
        ? undefined
        : {
            apiUrl: env.POUCHI_API_URL,
            tenantId: env.POUCHI_TENANT_ID ?? '',
            appId: env.POUCHI_APP_ID ?? '',
            vaultUrl: env.POUCHI_VAULT_URL,
            bridgeIssuer: env.POUCHI_BRIDGE_ISSUER,
            environment: env.POUCHI_ENVIRONMENT,
          },
    verifyMode: env.VERIFY_MODE,
    devLogin: env.DEV_LOGIN,
    reauthMode: env.REAUTH_MODE,
    policy: getPolicy(env.POLICY_PROFILE),
    payment: {
      path: env.PAYMENT_PATH,
      ownerMode: env.OWNER_MODE,
      floatMultiplier: BigInt(env.AGENT_FLOAT_MULTIPLIER),
      submittingAlertMs: env.SUBMITTING_ALERT_MS,
      confirmations: env.CONFIRMATIONS,
    },
    llm: {
      model: env.LLM_MODEL,
      effort: env.LLM_EFFORT,
      provider: env.LLM_PROVIDER,
      mode: env.LLM_MODE,
      dailyTokenCap: env.LLM_DAILY_TOKEN_CAP,
      weatherProvider: env.WEATHER_PROVIDER,
    },
    secrets: {
      sessionSecret: env.SESSION_SECRET,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      pouchiAppKey: env.POUCHI_APP_KEY,
      operatorKey: env.OPERATOR_KEY,
      waasAuthToken: env.WAAS_AUTH_TOKEN,
      agentKeyEncryptionKey: env.AGENT_KEY_ENCRYPTION_KEY,
      kakaoRestApiKey: env.KAKAO_REST_API_KEY,
      kakaoClientSecret: env.KAKAO_CLIENT_SECRET,
      googleClientIdWeb: env.GOOGLE_CLIENT_ID_WEB,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  };
}
