// S14 spike BFF (server side only). Runs inside the Vite dev server on localhost:3000.
// The app key stays here: it is read from the repo-root .env.pouchi (git-ignored, 0600) and is
// never sent to the browser, never logged, never put in a VITE_ variable.
// Pending bridge requests live in memory and are single use (the spike has one tab, one person).
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createVerifiedServerWaasClient, type ServerWaasBridgeClient } from '@nc-waas/sdk/server';

/** Public values from the Pouchi docs (sdk/embedded-start "설정 값"), not secrets. */
const VAULT_URL = 'https://auth.pouchi.io';
const BRIDGE_ISSUER = 'https://auth.pouchi.io';
/** The SDK app id registered with `pouchi apps origins add --app-id sikyeoyong`. */
const APP_ID = 'sikyeoyong';
const ORIGIN = 'http://localhost:3000';

function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return out;
}

function required(env: Record<string, string | undefined>, name: string): string {
  const v = env[name];
  if (v === undefined || v === '') throw new Error(`missing ${name}`);
  return v;
}

let client: Promise<ServerWaasBridgeClient> | undefined;
function waas(): Promise<ServerWaasBridgeClient> {
  if (client === undefined) {
    const file = readEnvFile(new URL('../../../.env.pouchi', import.meta.url).pathname);
    // CLAUDE.md 2: the chain id is not written here; pass it in the shell (README).
    const chainId = Number(required(process.env, 'CHAIN_ID'));
    client = createVerifiedServerWaasClient({
      apiUrl: required(file, 'POUCHI_API_URL'),
      tenantId: required(file, 'POUCHI_TENANT_ID'),
      appKey: required(file, 'POUCHI_APP_KEY'),
      bridgeIssuer: BRIDGE_ISSUER,
      expectedEnvironment: 'sandbox',
      expectedChainId: chainId,
    });
  }
  return client;
}

type Flow = 'signup' | 'login' | 'sign' | 'restore' | 'arm';
const pending = new Map<string, { flow: Flow; at: number }>();

async function body(req: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text === '' ? {} : JSON.parse(text);
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(value));
}

/** Vite middleware: GET /api/config, POST /api/bind, POST /api/complete. */
export async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url ?? '';
  if (!url.startsWith('/api/')) return next();
  try {
    if (req.method === 'GET' && url === '/api/config') {
      return send(res, 200, {
        vaultUrl: VAULT_URL,
        appId: APP_ID,
        callbackUrl: `${ORIGIN}/pouchi/callback`,
      });
    }
    // Same-origin writes only (the spike's stand-in for CSRF protection).
    if (
      req.method !== 'POST' ||
      req.headers['x-requested-with'] !== 'fetch' ||
      req.headers.origin !== ORIGIN
    ) {
      return send(res, 403, { error: 'forbidden' });
    }
    const input = (await body(req)) as Record<string, unknown>;
    if (url === '/api/bind') {
      const { requestId, flow } = input as { requestId: string; flow: Flow };
      pending.set(requestId, { flow, at: Date.now() });
      console.log(`[s14] bind ${flow} ${requestId}`);
      return send(res, 200, { ok: true });
    }
    if (url === '/api/complete') {
      const { envelope, codeVerifier, requestId } = input as {
        envelope: string;
        codeVerifier: string;
        requestId: string;
      };
      const p = pending.get(requestId);
      if (p === undefined) return send(res, 409, { error: 'unknown or used request' });
      pending.delete(requestId);
      const result = await (
        await waas()
      ).completeBridgeResult({
        envelope,
        codeVerifier,
        appId: APP_ID,
        requestId,
        flow: p.flow,
      });
      if (!result.ok) {
        console.log(`[s14] ${p.flow} ${result.claims.outcome} ${result.claims.error ?? ''}`);
        return send(res, 200, {
          ok: false,
          outcome: result.claims.outcome,
          error: result.claims.error,
        });
      }
      const w = result.wallet;
      console.log(
        `[s14] ${p.flow} ok wallet ${w.walletAddress} device ${w.deviceStatus} ownerVerified ${result.ownerVerified}`,
      );
      return send(res, 200, {
        ok: true,
        flow: p.flow,
        walletId: w.walletId,
        walletAddress: w.walletAddress,
        deviceStatus: w.deviceStatus,
        ownerVerified: result.ownerVerified,
      });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    // Error names and codes only; never echo request bodies (they carry envelopes).
    const err = e as { name?: string; code?: string; status?: number; message?: string };
    console.log(
      `[s14] error ${err.name ?? ''} ${err.code ?? ''} ${err.status ?? ''} ${err.message ?? ''}`,
    );
    return send(res, 500, { error: err.code ?? err.name ?? 'error' });
  }
}
