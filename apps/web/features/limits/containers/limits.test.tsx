import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderView } from '../../../lib/api';
import { BUDGET, ME } from '../../../lib/mock/fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const raiseLevel = vi.fn();
const getBudget = vi.fn();
const W12000 = okrwToAokrw(12_000n).toString();
const waiting: OrderView = {
  id: 'o-bossam',
  status: 'pending_approval',
  store: '한상보쌈',
  destination: '회사(역삼동)',
  items: [{ name: '보쌈 정식', quantity: 1, price: W12000 }],
  amount: W12000,
  etaAt: 1,
  remainingMin: 35,
  dragonLine: '주인님 허락을 기다려용.',
  dragonMood: 'worried',
};
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    getBudget: () => getBudget() as unknown,
    getOrder: () => Promise.resolve({ order: waiting }),
    raiseLevel: (l: number) => raiseLevel(l) as unknown,
  },
}));

const { BlockedContainer } = await import('./BlockedContainer');
const { RaiseContainer } = await import('./RaiseContainer');
const { CapContainer } = await import('./CapContainer');

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  raiseLevel.mockReset();
  raiseLevel.mockResolvedValue(undefined);
  getBudget.mockReset();
  getBudget.mockResolvedValue(BUDGET);
});

describe('limit screens', () => {
  it('Blocked compares 12,000 with 10,000 and offers level 2 (30,000), the lowest that covers it', async () => {
    wrap(<BlockedContainer orderId="o-bossam" />);
    expect(await screen.findByText(/보쌈 정식는/)).toBeInTheDocument();
    expect(screen.getByText('12,000원')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /레벨 2로 올리고 시키기/ }));
    expect(push).toHaveBeenCalledWith('/limit/o-bossam/raise');
  });

  it('the raise card changes nothing until its button, then raises to that level and goes to the chat', async () => {
    wrap(<RaiseContainer orderId="o-bossam" />);
    const confirm = await screen.findByRole('button', { name: /Face ID로 확인하고 바꾸기/ });
    expect(raiseLevel).not.toHaveBeenCalled();
    await userEvent.click(confirm);
    expect(raiseLevel).toHaveBeenCalledWith(2);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('Cap shows when the 30 days refill', async () => {
    getBudget.mockResolvedValue({
      ...BUDGET,
      chainResetAtSec: Math.floor(Date.now() / 1000) + 3_600,
    });
    wrap(<CapContainer />);
    expect(await screen.findByText(/다시 채워져요/)).toBeInTheDocument();
  });
});
