// The one place that picks the API implementation. Hooks import `api` from here and never the
// mock or the HTTP client directly. NEXT_PUBLIC_API_MODE=http talks to the API server (same
// origin /api); anything else keeps the in-memory mock, so screens work without a server.
import { mockApi } from '../mock/client';
import { createHttpApi } from './http-client';
import type { ApiClient } from './types';

// NEXT_PUBLIC_DEV_LOGIN_KEY (development only): sign in through the API's dev login until OAuth lands.
const devLoginKey = process.env.NEXT_PUBLIC_DEV_LOGIN_KEY?.trim() || undefined;

export const api: ApiClient =
  process.env.NEXT_PUBLIC_API_MODE === 'http' ? createHttpApi(fetch, '/api', devLoginKey) : mockApi;
export type * from './types';
