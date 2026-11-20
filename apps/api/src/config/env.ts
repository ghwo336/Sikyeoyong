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
  KAKAO_REST_API_KEY: optionalText,
  KAKAO_CLIENT_SECRET: optionalText,
  GOOGLE_CLIENT_ID_WEB: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  LLM_MODEL: optionalText,
  LLM_EFFORT: z.enum(LLM_EFFORTS).default('medium'),
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
  readonly chain: ChainConfig;
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
    /** Claude effort for the chat agent (Opus 5.5 default medium). */
    readonly effort: LlmEffort;
    readonly weatherProvider: 'static' | 'openmeteo';
  };
  /** Secrets stay here and are never logged (security.md). */
  readonly secrets: {
    readonly sessionSecret: string | undefined;
    readonly anthropicApiKey: string | undefined;
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
  need('ANTHROPIC_API_KEY', env.ANTHROPIC_API_KEY !== undefined);
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
    verifyMode: env.VERIFY_MODE,
    devLogin: env.DEV_LOGIN,
    policy: getPolicy(env.POLICY_PROFILE),
    payment: {
      path: env.PAYMENT_PATH,
      ownerMode: env.OWNER_MODE,
      floatMultiplier: BigInt(env.AGENT_FLOAT_MULTIPLIER),
      submittingAlertMs: env.SUBMITTING_ALERT_MS,
      confirmations: env.CONFIRMATIONS,
    },
    llm: { model: env.LLM_MODEL, effort: env.LLM_EFFORT, weatherProvider: env.WEATHER_PROVIDER },
    secrets: {
      sessionSecret: env.SESSION_SECRET,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
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
