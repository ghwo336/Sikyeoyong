import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAgentSetup = vi.fn();
vi.mock('../../../lib/api', () => ({ api: { getAgentSetup: () => getAgentSetup() as unknown } }));

const { useAgentSetup } = await import('./useSignup');

const PENDING = { status: 'PENDING', steps: [] } as const;

// One client per test: a new client per render would forget the query between polls.
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

/** Let one poll tick pass and its promise settle. */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useAgentSetup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getAgentSetup.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps asking every second after a failed GET (web.md "부화 다시 받기")', async () => {
    getAgentSetup
      .mockResolvedValueOnce(PENDING)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(PENDING);
    // Read the fields while rendering: TanStack Query re-renders only for fields read.
    const { result } = renderHook(
      () => {
        const q = useAgentSetup();
        return { isError: q.isError, status: q.data?.status };
      },
      { wrapper: makeWrapper() },
    );
    await tick(0);
    expect(getAgentSetup).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('PENDING');

    await tick(1_000);
    expect(getAgentSetup).toHaveBeenCalledTimes(2);
    await tick(1); // TanStack Query tells observers on the next timer tick.
    expect(result.current.isError).toBe(true);
    // The last known status stays, so polling goes on.
    expect(result.current.status).toBe('PENDING');

    await tick(1_000);
    expect(getAgentSetup).toHaveBeenCalledTimes(3);
    expect(result.current.isError).toBe(false);
  });

  it('stops asking once the dragon is up', async () => {
    getAgentSetup.mockResolvedValue({ status: 'ACTIVE', steps: [] });
    renderHook(() => useAgentSetup(), { wrapper: makeWrapper() });
    await tick(0);
    await tick(3_000);
    expect(getAgentSetup).toHaveBeenCalledTimes(1);
  });

  it('a failed first read is not asked again every second (QA 6 H2)', async () => {
    getAgentSetup.mockRejectedValue(new Error('500'));
    renderHook(() => useAgentSetup(), { wrapper: makeWrapper() });
    await tick(0);
    await tick(5_000);
    expect(getAgentSetup).toHaveBeenCalledTimes(1);
  });

  it('a PENDING dragon whose reads keep failing stops being asked every second', async () => {
    getAgentSetup.mockResolvedValueOnce(PENDING).mockRejectedValue(new Error('500'));
    renderHook(() => useAgentSetup(), { wrapper: makeWrapper() });
    await tick(0);
    await tick(10_000);
    // The first answer plus the failed polls up to the limit, then quiet.
    expect(getAgentSetup.mock.calls.length).toBeLessThanOrEqual(1 + 4);
  });
});
