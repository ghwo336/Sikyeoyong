// The one place that picks the API implementation. Hooks import `api` from here and never the
// mock or the HTTP client directly. NEXT_PUBLIC_API_MODE=http talks to the API server (same
// origin /api); anything else keeps the in-memory mock, so screens work without a server.
import { mockApi } from '../mock/client';
import { createHttpApi } from './http-client';
import type { ApiClient } from './types';

export const api: ApiClient =
  process.env.NEXT_PUBLIC_API_MODE === 'http' ? createHttpApi() : mockApi;
export type * from './types';
