import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUDGET } from '../../../lib/mock/fixtures';

const getBudget = vi.fn();
vi.mock('../../../lib/api', () => ({ api: { getBudget: () => getBudget() as unknown } }));

const { BudgetMeterContainer } = await import('./BudgetMeterContainer');

function draw() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BudgetMeterContainer />
    </QueryClientProvider>,
  );
}

describe('BudgetMeterContainer', () => {
  beforeEach(() => {
    getBudget.mockReset();
  });

  it('draws the meter when the budget arrives', async () => {
    getBudget.mockResolvedValue(BUDGET);
    draw();
    expect(await screen.findByText('30일 배달비')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a failed read keeps its place with an error line, never vanishing silently', async () => {
    getBudget.mockRejectedValue(new Error('500'));
    draw();
    expect(await screen.findByRole('alert')).toHaveTextContent('30일 배달비를 못 불러왔어요');
    expect(screen.queryByText('30일 배달비')).toBeNull();
  });

  it('the retry press asks again and the meter comes back', async () => {
    getBudget.mockRejectedValueOnce(new Error('500'));
    getBudget.mockResolvedValue(BUDGET);
    draw();
    await userEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('30일 배달비')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
