import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderView } from './api';
import { BUDGET, ME } from './mock/fixtures';
import { QUERY_RETRY_DELAY, makeQueryClient } from './query-provider';

const getBudget = vi.fn();
const getOrder = vi.fn();
const getMe = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('./api', () => ({
  api: {
    getBudget: () => getBudget() as unknown,
    getOrder: (id: string) => getOrder(id) as unknown,
    getMe: () => getMe() as unknown,
    getWallet: () => new Promise(() => undefined),
  },
}));

const { BudgetMeterContainer } = await import('../features/budget/containers/BudgetMeterContainer');
const { OrderStatusContainer } = await import('../features/orders/containers/OrderStatusContainer');
const { ReceiptContainer } = await import('../features/orders/containers/ReceiptContainer');

function draw(ui: ReactNode) {
  return render(<QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>);
}

/** Lets the failing calls and their retry timers run for this long. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('failed reads reach their error line in bounded time (QA 5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getBudget.mockReset();
    getOrder.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(ME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('the retry waits stay short (the default was 1, 2, 4 s)', () => {
    expect(QUERY_RETRY_DELAY(0)).toBeLessThanOrEqual(500);
    expect(QUERY_RETRY_DELAY(1) + QUERY_RETRY_DELAY(0)).toBeLessThan(1_500);
  });

  it('the 30-day meter shows its retry line within 1.5 s of /api/budget failing', async () => {
    getBudget.mockRejectedValue(new Error('500'));
    draw(<BudgetMeterContainer />);
    expect(screen.queryByRole('alert')).toBeNull();
    await wait(1_500);
    expect(screen.getByRole('alert')).toHaveTextContent('30일 배달비를 못 불러왔어요');
    expect(getBudget).toHaveBeenCalledTimes(2);
  });

  it('a meter that recovers on the retry never shows the error', async () => {
    getBudget.mockRejectedValueOnce(new Error('500'));
    getBudget.mockResolvedValue(BUDGET);
    draw(<BudgetMeterContainer />);
    await wait(1_500);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('30일 배달비')).toBeInTheDocument();
  });

  it('the order status shows its retry line within 1.5 s of a 500', async () => {
    getOrder.mockRejectedValue(new Error('500'));
    draw(<OrderStatusContainer orderId="o1" />);
    await wait(1_500);
    expect(screen.getByRole('alert')).toHaveTextContent('주문 현황을 못 불러왔어요');
  });

  it('the receipt shows its retry line within 1.5 s of a 500', async () => {
    getOrder.mockRejectedValue(new Error('500'));
    draw(<ReceiptContainer orderId="o1" />);
    await wait(1_500);
    expect(screen.getByRole('alert')).toHaveTextContent('주문 내역을 못 불러왔어요');
  });

  it('the order status with /me down ends in the retry line under 3 s, not 7 s', async () => {
    getOrder.mockResolvedValue({ order: { id: 'o1' } as OrderView });
    getMe.mockRejectedValue(new Error('500'));
    draw(<OrderStatusContainer orderId="o1" />);
    await wait(3_000);
    expect(screen.getByRole('alert')).toHaveTextContent('주문 현황을 못 불러왔어요');
  });
});
