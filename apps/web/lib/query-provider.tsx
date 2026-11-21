'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

/**
 * How long a failed read waits before it asks again: 0.4 s, 0.8 s, 1.6 s. TanStack's default is
 * 3 retries at 1, 2, 4 s, so a read that never answers stayed a skeleton for 7 s before any error
 * line could show (QA 5). Reads are safe to repeat, so a short bounded retry hides a hiccup and
 * a real outage reaches its error line in about half a second (one retry) or under 3 s (/me, 3).
 */
export const QUERY_RETRY_DELAY = (failureCount: number): number => 400 * 2 ** failureCount;

/** One try again for a failed read: screens show their error line after 0.4 s plus the calls. */
export const QUERY_RETRIES = 1;

/** The query client every screen uses; tests build theirs from here so retry timing is real. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: QUERY_RETRIES,
        retryDelay: QUERY_RETRY_DELAY,
      },
      // Payment must never be retried on its own (CLAUDE.md rule 9). Keep every mutation manual.
      mutations: { retry: false },
    },
  });
}

/** One TanStack Query client per browser tab (web.md: server state is TanStack Query). */
export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
