// The one place that picks the API implementation. Hooks import `api` from here and never the
// mock directly, so moving to the real HTTP client (packages/shared API client) is this file only.
import { mockApi } from '../mock/client';
import type { ApiClient } from './types';

export const api: ApiClient = mockApi;
export type * from './types';
