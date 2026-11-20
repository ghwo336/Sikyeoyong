import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LimitChangeCardView } from '../../../lib/api';
import { BUDGET } from '../../../lib/mock/fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
const W = (won: bigint) => okrwToAokrw(won).toString();
vi.mock('../../../lib/api', () => ({
  api: { getBudget: () => Promise.resolve({ ...BUDGET, perOrderLimit: W(50_000n) }) },
}));

const { LimitChangeContainer } = await import('./LimitChangeContainer');

const card = (from: bigint, to: bigint): LimitChangeCardView => ({
  cardId: 'c1',
  field: 'perOrder',
  from: W(from),
  to: W(to),
  needsReauth: true,
  rows: [],
});

function wrap(c: LimitChangeCardView) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LimitChangeContainer card={c} species="forest" />
    </QueryClientProvider>,
  );
}

describe('LimitChangeContainer: a card from the history (browser QA)', () => {
  it('already applied (the limit is its "after"): the done line, no button', async () => {
    wrap(card(10_000n, 50_000n));
    expect(await screen.findByText(/이제 한 번에 50,000원까지/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /바꾸기/ })).toBeNull();
  });

  it('outdated (the limit is neither its before nor its after): nothing to press', async () => {
    const { container } = wrap(card(10_000n, 30_000n));
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('still current: the card with its button', async () => {
    wrap(card(50_000n, 45_000n));
    expect(await screen.findByRole('button', { name: /바꾸기/ })).toBeInTheDocument();
  });
});
