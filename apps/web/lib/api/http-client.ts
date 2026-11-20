// The ApiClient over HTTP. Same origin: in production Caddy sends /api to the API server,
// in development next.config.ts rewrites it (D-03), so the session cookie just rides along.
// Every answer is checked against the shared zod schema the server also uses; an error body
// ({ error: { code, message, dragonLine } }, server-api.md) becomes an AppError.
import {
  APP_ERROR_CODES,
  AppError,
  type AppErrorCode,
  type ChatEvent,
  zAgentSetupView,
  zBudgetView,
  zChatEvent,
  zChatHistory,
  zCreateOrderResult,
  zFreezeResult,
  zIdCardView,
  zRefundResult,
  zTrialResult,
  zWalletView,
  zMeView,
  zIdentityStatus,
  zOrderResult,
  zPouchiLoginConfig,
  zSetLimitsResult,
  zSignupConfig,
} from '@sikyeoyong/shared';
import type { ApiClient } from './types';

/** What the screens may show from a refused call (never the server's internals). */
export interface ApiErrorDetail {
  readonly status: number;
  readonly message?: string;
  readonly dragonLine?: string;
}

interface ErrorBody {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly dragonLine?: unknown;
}

function errorOf(body: unknown): ErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return {};
  const e = body.error;
  return typeof e === 'object' && e !== null ? e : {};
}

/** POST /agents answer: { agent: { id, status: 'PENDING' } } (agents.controller). */
function agentCreated(body: unknown): { agent: { id: string; status: 'PENDING' } } {
  const agent = typeof body === 'object' && body !== null && 'agent' in body ? body.agent : null;
  if (
    typeof agent === 'object' &&
    agent !== null &&
    'id' in agent &&
    typeof agent.id === 'string' &&
    agent.id !== '' &&
    'status' in agent &&
    agent.status === 'PENDING'
  ) {
    return { agent: { id: agent.id, status: 'PENDING' } };
  }
  throw new AppError('INTERNAL', { status: 200, message: 'unexpected POST /agents answer' });
}

function toAppError(status: number, body: unknown): AppError {
  const e = errorOf(body);
  const known =
    typeof e.code === 'string' && (APP_ERROR_CODES as readonly string[]).includes(e.code)
      ? (e.code as AppErrorCode)
      : 'INTERNAL';
  const detail: ApiErrorDetail = {
    status,
    ...(typeof e.message === 'string' ? { message: e.message } : {}),
    ...(typeof e.dragonLine === 'string' ? { dragonLine: e.dragonLine } : {}),
  };
  return new AppError(known, detail);
}

/** An error body we can read, or undefined (a proxy's HTML 502, a plain-text 504, nothing). */
async function errorBody(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    return text === '' ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

/** Not on the server yet: refuse plainly instead of pretending (no fake success). */
function notReady(what: string): Promise<never> {
  return Promise.reject(new AppError('INTERNAL', { status: 0, message: `${what} is not ready` }));
}

/** Splits an SSE body into ChatEvents (`data: <json>` frames, blank-line separated). */
export function parseSseEvents(text: string): ChatEvent[] {
  return text
    .split('\n\n')
    .map((frame) => frame.trim())
    .filter((frame) => frame.startsWith('data: '))
    .map((frame) => zChatEvent.parse(JSON.parse(frame.slice('data: '.length))));
}

/**
 * devLoginKey: with a key, login() uses the local dev login (POST /api/auth/dev-login,
 * open only when the API runs with DEV_LOGIN=true). Without one, login waits for OAuth.
 */
export function createHttpApi(
  fetchImpl: typeof fetch = fetch,
  base = '/api',
  devLoginKey?: string,
): ApiClient {
  async function call(method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string, body?: unknown) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        // CSRF guard on cookie writes (tech-spec 9.4); harmless on reads.
        'X-Requested-With': 'fetch',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw toAppError(res.status, await errorBody(res));
    const text = await res.text();
    return text === '' ? undefined : (JSON.parse(text) as unknown);
  }

  return {
    getMe: async () => zMeView.parse(await call('GET', '/me')),
    getBudget: async () => zBudgetView.parse(await call('GET', '/budget')),
    getChatHistory: async () => zChatHistory.parse(await call('GET', '/chat/history')),
    sendChatMessage: async (body, onEvent) => {
      const res = await fetchImpl(`${base}/chat/messages`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw toAppError(res.status, await errorBody(res));
      // Read frames as they come (D-23: words appear while the dragon writes).
      const events: ChatEvent[] = [];
      const take = (frames: string) => {
        for (const e of parseSseEvents(frames)) {
          events.push(e);
          onEvent?.(e);
        }
      };
      if (res.body === null) {
        take(await res.text());
        return events;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const cut = buffer.lastIndexOf('\n\n');
        if (cut >= 0) {
          take(buffer.slice(0, cut + 2));
          buffer = buffer.slice(cut + 2);
        }
        if (done) break;
      }
      take(buffer);
      return events;
    },
    createOrder: async (body) => zCreateOrderResult.parse(await call('POST', '/orders', body)),
    confirmOrder: async (orderId) =>
      zOrderResult.parse(await call('POST', `/orders/${encodeURIComponent(orderId)}/confirm`)),
    getOrder: async (orderId) =>
      zOrderResult.parse(await call('GET', `/orders/${encodeURIComponent(orderId)}`)),
    rateOrder: async (orderId, value) => {
      await call('POST', `/orders/${encodeURIComponent(orderId)}/rating`, { value });
    },
    getSignupConfig: async () => zSignupConfig.parse(await call('GET', '/signup/config')),
    // Without a dev key the login is the Pouchi vault (lib/session/entry.ts), not this.
    login: async () => {
      if (devLoginKey === undefined) return notReady('direct login');
      await call('POST', '/auth/dev-login', { key: devLoginKey });
    },
    getIdentity: async () => zIdentityStatus.parse(await call('GET', '/identity')),
    getPouchiLoginConfig: async () =>
      zPouchiLoginConfig.parse(await call('GET', '/auth/pouchi/config')),
    pouchiBind: async (body) => {
      await call('POST', '/auth/pouchi/bind', body);
    },
    pouchiComplete: async (body) => {
      await call('POST', '/auth/pouchi/complete', body);
    },
    verifyIdentity: async () => {
      await call('POST', '/identity/verify');
      return { verified: true };
    },
    createAgent: async (body) => agentCreated(await call('POST', '/agents', body)),
    getAgentSetup: async () => zAgentSetupView.parse(await call('GET', '/agents/me')),
    retryAgentSetup: async () => {
      await call('POST', '/agents/me/setup/retry');
    },
    claimTrialAllowance: async () => {
      zTrialResult.parse(await call('POST', '/signup/trial'));
    },
    getWallet: async () => zWalletView.parse(await call('GET', '/wallet')),
    getIdCard: async () => zIdCardView.parse(await call('GET', '/me/id-card')),
    // The kill switch: the owner's button only, never an LLM tool (user-flow 17).
    setFrozen: async (frozen) => {
      zFreezeResult.parse(await call('POST', frozen ? '/agents/me/freeze' : '/agents/me/unfreeze'));
    },
    refundPocket: async () => {
      zRefundResult.parse(await call('POST', '/agents/me/drain'));
    },
    // D-28, D-31: the owner's button only (never an LLM tool); the server writes the chain limit first.
    setLimits: async (body) => zSetLimitsResult.parse(await call('PUT', '/agents/me/limits', body)),
  };
}
