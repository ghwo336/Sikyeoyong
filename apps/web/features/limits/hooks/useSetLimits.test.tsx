import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const setLimits = vi.fn();
const getBudget = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    setLimits: (b: unknown) => setLimits(b) as unknown,
    getBudget: () => getBudget() as unknown,
    getMe: () => Promise.resolve({}),
  },
}));

const { useSetLimits } = await import('./useSetLimits');
const { useBudget } = await import('../../budget/hooks/useBudget');

describe('useSetLimits (QA 6 L5)', () => {
  it('hands the answer on without waiting for the slow budget read', async () => {
    setLimits.mockResolvedValue({ perOrderLimit: '1', myPeriodicLimit: '1' });
    // The budget read (it reads the chain) never comes back during this test.
    getBudget.mockReturnValue(new Promise(() => undefined));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    // An open budget observer, like the chat behind the card.
    renderHook(() => useBudget(), { wrapper });
    const { result } = renderHook(() => useSetLimits(), { wrapper });
    const done = vi.fn();
    act(() => {
      result.current.mutate({ perOrderLimit: '1' }, { onSuccess: done });
    });
    await waitFor(() => {
      expect(done).toHaveBeenCalledTimes(1);
    });
    expect(qc.getQueryState(['budget'])?.isInvalidated).toBe(true);
  });
});
