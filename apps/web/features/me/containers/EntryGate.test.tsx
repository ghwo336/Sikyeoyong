import { AppError } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME } from '../../../lib/mock/fixtures';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

const getMe = vi.fn();
const getAgentSetup = vi.fn();
const getIdentity = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => getMe() as unknown,
    getAgentSetup: () => getAgentSetup() as unknown,
    getIdentity: () => getIdentity() as unknown,
  },
}));

const { EntryGate } = await import('./EntryGate');

const setupOf = (status: 'PENDING' | 'ACTIVE' | 'FAILED') => ({
  status,
  steps: [
    { key: 'wallet', status: 'done' },
    { key: 'identity', status: 'done' },
    { key: 'limit', status: status === 'ACTIVE' ? 'done' : 'doing' },
  ],
});

function draw() {
  // retryDelay 0 so the gate's own retry rule (retryMe) runs without waiting.
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <EntryGate>
        <p>대화 화면</p>
      </EntryGate>
    </QueryClientProvider>,
  );
}

describe('EntryGate', () => {
  beforeEach(() => {
    replace.mockReset();
    getMe.mockReset();
    getAgentSetup.mockReset();
    getIdentity.mockReset();
    getIdentity.mockResolvedValue({ verified: true });
  });

  it('a signed-in owner without a dragon who has not passed the identity check goes to Verify', async () => {
    getMe.mockRejectedValue(new AppError('NOT_FOUND'));
    getIdentity.mockResolvedValue({ verified: false });
    draw();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/verify');
    });
    expect(replace).not.toHaveBeenCalledWith('/name');
  });

  it('when the identity answer fails, it still moves on, to Verify (never a blank screen)', async () => {
    getMe.mockRejectedValue(new AppError('NOT_FOUND'));
    getIdentity.mockRejectedValue(new AppError('INTERNAL'));
    draw();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/verify');
    });
  });

  it('shows nothing while it does not know yet', () => {
    getMe.mockReturnValue(new Promise(() => undefined));
    draw();
    expect(screen.queryByText('대화 화면')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    [new AppError('UNAUTHENTICATED'), '/start'],
    [new AppError('NOT_FOUND'), '/name'],
  ])('sends %s to %s, once (no retry), without drawing the chat', async (err, to) => {
    getMe.mockRejectedValue(err);
    draw();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(to);
    });
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('대화 화면')).toBeNull();
  });

  it.each(['PENDING', 'FAILED'] as const)('sends a %s dragon to Hatch', async (status) => {
    getMe.mockResolvedValue(ME);
    getAgentSetup.mockResolvedValue(setupOf(status));
    draw();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/hatch');
    });
    expect(screen.queryByText('대화 화면')).toBeNull();
  });

  it('draws the chat for a hatched dragon and goes nowhere', async () => {
    getMe.mockResolvedValue(ME);
    getAgentSetup.mockResolvedValue(setupOf('ACTIVE'));
    draw();
    expect(await screen.findByText('대화 화면')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('after retries, a server error draws the screen (its own error), never a blank page', async () => {
    getMe.mockRejectedValue(new AppError('INTERNAL'));
    draw();
    expect(await screen.findByText('대화 화면')).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(4); // first try and three retries
    expect(replace).not.toHaveBeenCalled();
  });
});
