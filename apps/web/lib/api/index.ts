// The one place that picks the API implementation. Hooks import `api` from here and never the
// mock or the HTTP client directly. NEXT_PUBLIC_API_MODE=http talks to the API server (same
// origin /api); anything else keeps the in-memory mock, so screens work without a server.
import { mockApi } from '../mock/client';
import { createHttpApi } from './http-client';
import type { ApiClient } from './types';

// NEXT_PUBLIC_DEV_LOGIN_KEY (development only): sign in through the API's dev login instead of the vault.
const devLoginKey = process.env.NEXT_PUBLIC_DEV_LOGIN_KEY?.trim() || undefined;

const http = process.env.NEXT_PUBLIC_API_MODE === 'http';

export const api: ApiClient = http ? createHttpApi(fetch, '/api', devLoginKey) : mockApi;

/**
 * How "이메일로 시작하기" logs in (D-29): the Pouchi vault against the real API, or the direct
 * login (the mock's, or the dev login with a key). lib/session/entry.ts reads this.
 */
export const loginKind: 'vault' | 'direct' = http && devLoginKey === undefined ? 'vault' : 'direct';
export type * from './types';
