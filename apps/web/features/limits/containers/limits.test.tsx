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

const setLimits = vi.fn();
const requoteOrder = vi.fn();
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
    setLimits: (b: unknown) => setLimits(b) as unknown,
    requoteOrder: (id: string) => requoteOrder(id) as unknown,
  },
}));

const { BlockedContainer } = await import('./BlockedContainer');
const { RaiseContainer } = await import('./RaiseContainer');
const { CapContainer } = await import('./CapContainer');

let qc: QueryClient;
function wrap(ui: ReactNode) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  setLimits.mockReset();
  setLimits.mockResolvedValue({
    perOrderLimit: okrwToAokrw(15_000n).toString(),
    myPeriodicLimit: BUDGET.myPeriodicLimit,
    txHash: null,
  });
  requoteOrder.mockReset();
  requoteOrder.mockResolvedValue({ order: { id: 'o-bossam', status: 'pending_approval' } });
  getBudget.mockReset();
  getBudget.mockResolvedValue(BUDGET);
});

describe('limit screens', () => {
  it('Blocked compares 12,000 with 10,000 and offers 15,000, the smallest step that covers it (D-31)', async () => {
    wrap(<BlockedContainer orderId="o-bossam" />);
    expect(await screen.findByText(/보쌈 정식은/)).toBeInTheDocument();
    expect(screen.getByText('12,000원')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /한 번에 15,000원으로 올리고 시키기/ }),
    );
    expect(push).toHaveBeenCalledWith('/limit/o-bossam/raise');
  });

  it('the raise card changes nothing until its button, then raises to that amount and goes to the chat', async () => {
    wrap(<RaiseContainer orderId="o-bossam" />);
    const confirm = await screen.findByRole('button', { name: /Face ID로 확인하고 바꾸기/ });
    expect(setLimits).not.toHaveBeenCalled();
    await userEvent.click(confirm);
    expect(setLimits).toHaveBeenCalledWith({ perOrderLimit: okrwToAokrw(15_000n).toString() });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('after the raise the waiting order is quoted again and handed to the chat (user-flow 12, O -> I)', async () => {
    const quote = {
      orderId: 'o-bossam',
      store: '한상보쌈',
      destination: '회사(역삼동)',
      etaMin: 35,
      items: [{ name: '보쌈 정식', quantity: 1, price: W12000 }],
      amount: W12000,
      dragonLine: '보쌈 정식 시킬게용.\n이대로 괜찮아용?',
      perOrderLimit: okrwToAokrw(15_000n).toString(),
      periodUsedAfter: W12000,
      periodCap: BUDGET.chainCap,
    };
    requoteOrder.mockResolvedValue({ order: { id: 'o-bossam', status: 'quoted' }, quote });
    wrap(<RaiseContainer orderId="o-bossam" />);
    await userEvent.click(await screen.findByRole('button', { name: /Face ID로 확인하고 바꾸기/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
    expect(requoteOrder).toHaveBeenCalledWith('o-bossam');
    expect(qc.getQueryData(['chat', 'handoff'])).toEqual(quote);
  });

  it('Cap shows when the 30 days refill', async () => {
    getBudget.mockResolvedValue({
      ...BUDGET,
      chainResetAtSec: Math.floor(Date.now() / 1000) + 3_600,
    });
    wrap(<CapContainer />);
    expect(await screen.findByText(/다시 채워져요/)).toBeInTheDocument();
  });

  it('an order within the limit (waiting for another reason) gets no raise offer', async () => {
    getBudget.mockResolvedValue({
      ...BUDGET,
      perOrderLimit: okrwToAokrw(30_000n).toString(),
    });
    wrap(<BlockedContainer orderId="o-bossam" />);
    await waitFor(() => {
      expect(getBudget).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /올리고 시키기/ })).toBeNull();
  });

  it('no raise card when the limit already covers the order', async () => {
    getBudget.mockResolvedValue({
      ...BUDGET,
      perOrderLimit: okrwToAokrw(30_000n).toString(),
    });
    wrap(<RaiseContainer orderId="o-bossam" />);
    await waitFor(() => {
      expect(getBudget).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /Face ID로 확인하고 바꾸기/ })).toBeNull();
  });
});
