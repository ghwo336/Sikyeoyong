import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resumeSession = vi.fn();
const replace = vi.fn();
vi.mock('../../../lib/session/entry', () => ({ resumeSession: () => resumeSession() as unknown }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const { PouchiCallbackContainer } = await import('./PouchiCallbackContainer');

const wrap = (ui: ReactNode, qc = new QueryClient()) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

beforeEach(() => {
  resumeSession.mockReset();
  replace.mockReset();
});

describe('PouchiCallbackContainer (/pouchi/callback)', () => {
  it('finishes the returned login once, drops the old me answer, then goes to the front door', async () => {
    resumeSession.mockResolvedValue(true);
    const qc = new QueryClient();
    qc.setQueryData(['me'], { stale: true });
    wrap(<PouchiCallbackContainer />, qc);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
    expect(resumeSession).toHaveBeenCalledTimes(1);
    expect(qc.getQueryState(['me'])).toBeUndefined();
  });

  it('a failed result is not a login: one line and a way back to the start', async () => {
    resumeSession.mockRejectedValue(new Error('401'));
    wrap(<PouchiCallbackContainer />);
    expect(await screen.findByRole('alert')).toHaveTextContent('로그인을 마치지 못했어요');
    expect(replace).not.toHaveBeenCalledWith('/');
    await userEvent.click(screen.getByRole('button', { name: '처음으로' }));
    expect(replace).toHaveBeenCalledWith('/start');
  });
});
