import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUDGET, ME, WALLET } from '../../../lib/mock/fixtures';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));

const setLimits = vi.fn();
const getBudget = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    getBudget: () => getBudget() as unknown,
    getWallet: () => Promise.resolve(WALLET),
    setLimits: (b: unknown) => setLimits(b) as unknown,
  },
}));

const { LimitEditContainer } = await import('./LimitEditContainer');
const { LimitRowsContainer } = await import('../../wallet/containers/LimitRowsContainer');

const won = (n: bigint) => okrwToAokrw(n).toString();

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  setLimits.mockReset();
  setLimits.mockResolvedValue({
    perOrderLimit: BUDGET.perOrderLimit,
    myPeriodicLimit: BUDGET.myPeriodicLimit,
    txHash: null,
  });
  getBudget.mockReset();
  getBudget.mockResolvedValue(BUDGET);
});

describe('the wallet rows open the limit screen (QA 5)', () => {
  it('both limit rows are pressable and go to /dragon/limits', async () => {
    wrap(<LimitRowsContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /한 번에 쓸 돈/ }));
    await userEvent.click(screen.getByRole('button', { name: /30일에 쓸 돈/ }));
    expect(push).toHaveBeenNthCalledWith(1, '/dragon/limits');
    expect(push).toHaveBeenNthCalledWith(2, '/dragon/limits');
  });
});

describe('LimitEditContainer (D-28, D-31)', () => {
  it('has nothing to send until a stepper moves', async () => {
    wrap(<LimitEditContainer />);
    const save = await screen.findByRole('button', { name: '바꾸기' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(save);
    expect(setLimits).not.toHaveBeenCalled();
  });

  it('lowering is saved at once, with no re-auth step, and goes back to the wallet', async () => {
    wrap(<LimitEditContainer />);
    await userEvent.click(
      await screen.findByRole('button', { name: '30일에 쓸 돈 10,000원 내리기' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    expect(setLimits).toHaveBeenCalledTimes(1);
    expect(setLimits).toHaveBeenCalledWith({ myPeriodicLimit: won(50_000n) });
    expect(screen.queryByRole('button', { name: /Face ID/ })).toBeNull();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/dragon');
    });
  });

  it('raising shows the re-auth card first and sends nothing until its button is pressed', async () => {
    wrap(<LimitEditContainer />);
    const more = await screen.findByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' });
    await userEvent.click(more);
    await userEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    expect(setLimits).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Face ID로 확인하고 바꾸기/ }));
    expect(setLimits).toHaveBeenCalledTimes(1);
    expect(setLimits).toHaveBeenCalledWith({ perOrderLimit: won(15_000n) });
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/dragon');
    });
  });

  it('the card can be left without changing anything', async () => {
    wrap(<LimitEditContainer />);
    await userEvent.click(
      await screen.findByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    await userEvent.click(screen.getByRole('button', { name: /그만두기|취소|그만/ }));
    expect(setLimits).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '바꾸기' })).toBeInTheDocument();
  });

  it('keeps one order at or under 30 days: the 30-day stepper cannot go below it', async () => {
    wrap(<LimitEditContainer />);
    const less = await screen.findByRole('button', { name: '30일에 쓸 돈 10,000원 내리기' });
    for (let i = 0; i < 8; i += 1) await userEvent.click(less);
    // Down to the floor: the per-order amount now (10,000). Raising one order carries it up.
    expect(less).toHaveAttribute('aria-disabled', 'true');
    const more = screen.getByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' });
    await userEvent.click(more);
    await userEvent.click(more);
    expect(less).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    await userEvent.click(screen.getByRole('button', { name: /Face ID로 확인하고 바꾸기/ }));
    expect(setLimits).toHaveBeenCalledWith({
      perOrderLimit: won(20_000n),
      myPeriodicLimit: won(20_000n),
    });
  });

  it('a failed change says so and can be pressed again, with no automatic retry', async () => {
    setLimits.mockRejectedValueOnce(new Error('500'));
    wrap(<LimitEditContainer />);
    await userEvent.click(
      await screen.findByRole('button', { name: '30일에 쓸 돈 10,000원 내리기' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    expect(await screen.findByText(/못 바꿨어요/)).toBeInTheDocument();
    expect(setLimits).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/dragon');
    });
  });

  it('a budget that cannot load ends in a retry line, not a blank screen', async () => {
    getBudget.mockRejectedValue(new Error('500'));
    wrap(<LimitEditContainer />);
    expect(await screen.findByRole('alert')).toHaveTextContent('한도를 못 불러왔어요');
  });

  it('back goes to the wallet', async () => {
    wrap(<LimitEditContainer />);
    await screen.findByRole('button', { name: '바꾸기' });
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(replace).toHaveBeenCalledWith('/dragon');
  });
});
