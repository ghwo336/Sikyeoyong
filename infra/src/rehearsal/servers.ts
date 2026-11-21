import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { cpSync, createWriteStream, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * The rehearsal's own api and web (never 3000 or the running dev servers): a temp SQLite
 * database, the mock payment path, the demo profile, replayed dragon turns (D-26), plain http.
 * Everything it starts is stopped by `stop()`, also on a crash or Ctrl+C.
 */
export const REPO_ROOT = resolve(import.meta.dirname, '../../..');
/** Fixed dev-login key the web sends (a fresh database each run, so the user is new). */
export const DEV_LOGIN_KEY = 'rehearsal';

/** Variables a developer's .env may carry that the rehearsal must not pick up (blank = unset). */
export const BLANKED = [
  'POUCHI_API_URL',
  'POUCHI_TENANT_ID',
  'POUCHI_APP_KEY',
  'POUCHI_APP_ID',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'LLM_MODEL',
  'OPERATOR_KEY',
  'WAAS_AUTH_TOKEN',
  'AGENT_KEY_ENCRYPTION_KEY',
  'ORDERS_CONTRACT',
  'ORDERS_DEPLOY_BLOCK',
  'MAROO_RPC_URL',
  'CHAIN_ID',
  'OKRW_DENOM',
  'KAKAO_REST_API_KEY',
  'KAKAO_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID_WEB',
  'GOOGLE_CLIENT_SECRET',
  'LLM_DAILY_TOKEN_CAP',
  'LLM_USER_DAILY_TOKEN_CAP',
  'DEMO_BYPASS_SERVER_LIMIT',
  'REAUTH_MODE',
  'POUCHI_VAULT_URL',
  'POUCHI_BRIDGE_ISSUER',
  'POUCHI_ENVIRONMENT',
  'GOOGLE_CLIENT_ID_IOS',
  'APPLE_SERVICE_ID',
  'LLM_PROVIDER',
  'LLM_EFFORT',
  'WEATHER_LAT',
  'WEATHER_LON',
  'KYB_SCHEMA_UID',
  'CONFIRMATIONS',
  'OWNER_MODE',
  'AGENT_FLOAT_MULTIPLIER',
  'AGENT_GAS_SHARE_OKRW',
  'SUBMITTING_ALERT_MS',
  'NTS_SERVICE_KEY',
  'BIZNO_HMAC_KEY',
];

export interface Ports {
  readonly api: number;
  readonly web: number;
}

/** The api environment of a rehearsal. Pure, so the settings can be tested. */
export function apiEnv(ports: Ports, dbPath: string): Record<string, string> {
  const blank = Object.fromEntries(BLANKED.map((k) => [k, '']));
  return {
    ...blank,
    NODE_ENV: 'development',
    PORT: String(ports.api),
    DATABASE_URL: `file:${dbPath}`,
    PUBLIC_BASE_URL: `http://localhost:${String(ports.web)}`,
    SESSION_SECRET: 'rehearsal-session-secret-not-for-real-use-0123456789',
    DEMO_MODE: 'true',
    DEV_LOGIN: 'true',
    VERIFY_MODE: 'mock',
    PAYMENT_PATH: 'mock',
    POLICY_PROFILE: 'demo',
    LLM_MODE: 'replay',
    WEATHER_PROVIDER: 'static',
    WEATHER_STATIC: '비',
  };
}

/** The web environment: the screens talk to the real api through Next's /api rewrite. */
export function webEnv(ports: Ports): Record<string, string> {
  return {
    NODE_ENV: 'development',
    API_DEV_ORIGIN: `http://localhost:${String(ports.api)}`,
    NEXT_PUBLIC_API_MODE: 'http',
    NEXT_PUBLIC_DEV_LOGIN_KEY: DEV_LOGIN_KEY,
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_DIST_DIR: '.next-rehearsal',
  };
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      s.close(() => {
        if (addr !== null && typeof addr === 'object') ok(addr.port);
        else fail(new Error('no port'));
      });
    });
  });
}

/** Only what a child needs to run; the developer's own environment stays out. */
function baseEnv(): Record<string, string> {
  const keep = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'SHELL'];
  return Object.fromEntries(
    keep.flatMap((k) => (process.env[k] === undefined ? [] : [[k, process.env[k]]])),
  );
}

async function waitFor(url: string, what: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `${what} did not come up in ${String(ms / 1000)}s (see the logs in the work dir)`,
  );
}

/**
 * The rehearsal builds into its own folder, so the owner's `nest start --watch` (which owns
 * apps/api/dist) is never rewritten or emptied under them.
 */
export const API_OUT = 'dist-rehearsal';

function buildApi(): { status: number | null; stdout: string; stderr: string } {
  const cwd = join(REPO_ROOT, 'apps/api');
  const tsc = spawnSync(
    'pnpm',
    ['exec', 'tsc', '-p', 'tsconfig.build.json', '--outDir', API_OUT, '--incremental', 'false'],
    { cwd, env: baseEnv(), encoding: 'utf8' },
  );
  if (tsc.status !== 0) return tsc;
  rmSync(join(cwd, API_OUT, 'db/migrations'), { recursive: true, force: true });
  cpSync(join(cwd, 'src/db/migrations'), join(cwd, API_OUT, 'db/migrations'), { recursive: true });
  return tsc;
}

export interface Rehearsal {
  readonly webUrl: string;
  readonly apiUrl: string;
  readonly workDir: string;
  stop(): void;
}

/** Builds the api, migrates and seeds a temp database, then starts the api and the web. */
export async function startServers(log: (line: string) => void): Promise<Rehearsal> {
  const workDir = mkdtempSync(join(tmpdir(), 'sikyeoyong-rehearsal-'));
  const children: ChildProcess[] = [];
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    for (const c of children) {
      try {
        if (c.pid !== undefined) process.kill(-c.pid, 'SIGTERM');
      } catch {
        // already gone
      }
    }
    for (const f of ['rehearsal.db', 'rehearsal.db-shm', 'rehearsal.db-wal']) {
      rmSync(join(workDir, f), { force: true });
    }
  };
  process.once('exit', stop);
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sig, () => {
      stop();
      process.exit(130);
    });
  }
  try {
    const ports: Ports = { api: await freePort(), web: await freePort() };
    const dbPath = join(workDir, 'rehearsal.db');
    const env = { ...baseEnv(), ...apiEnv(ports, dbPath) };
    log('api build');
    const build =
      process.env.REHEARSE_SKIP_BUILD === '1' ? { status: 0, stdout: '', stderr: '' } : buildApi();
    if (build.status !== 0) throw new Error(`api build failed\n${build.stdout}${build.stderr}`);
    for (const script of ['migrate', 'seed']) {
      log(`db ${script}`);
      const r = spawnSync('node', [`apps/api/${API_OUT}/db/${script}.js`], {
        cwd: REPO_ROOT,
        env,
        encoding: 'utf8',
      });
      if (r.status !== 0) throw new Error(`db ${script} failed\n${r.stdout}${r.stderr}`);
    }
    mkdirSync(workDir, { recursive: true });
    const start = (name: string, cmd: string, args: string[], cwd: string, e: object) => {
      const out = createWriteStream(join(workDir, `${name}.log`));
      const child = spawn(cmd, args, { cwd, env: e as NodeJS.ProcessEnv, detached: true });
      child.stdout.pipe(out);
      child.stderr.pipe(out);
      children.push(child);
    };
    start('api', 'node', [`${API_OUT}/main.js`], join(REPO_ROOT, 'apps/api'), env);
    start(
      'web',
      'node',
      ['node_modules/next/dist/bin/next', 'dev', '--port', String(ports.web)],
      join(REPO_ROOT, 'apps/web'),
      { ...baseEnv(), ...webEnv(ports) },
    );
    const apiUrl = `http://localhost:${String(ports.api)}`;
    const webUrl = `http://localhost:${String(ports.web)}`;
    log(`waiting for api ${apiUrl} and web ${webUrl}`);
    await waitFor(`${apiUrl}/api/health`, 'api', 60_000);
    await waitFor(`${webUrl}/start`, 'web', 120_000);
    return { webUrl, apiUrl, workDir, stop };
  } catch (err) {
    stop();
    throw err;
  }
}
