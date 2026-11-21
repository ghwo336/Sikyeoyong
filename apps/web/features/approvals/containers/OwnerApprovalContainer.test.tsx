import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalDecision, OrderQuote } from '../../../lib/api';
import type { OwnerApproval } from '../owner';

// The real card, with its props handed to the test so two callbacks can fire back to back.
const cardProps = vi.hoisted(() => ({
  current: null as null | ((p: { onApprove: () => void; onReject: () => void }) => void),
}));
vi.mock('@sikyeoyong/ui', async (importOriginal) => {
  const real = await importOriginal<typeof import('@sikyeoyong/ui')>();
  return {
    ...real,
    OwnerApprovalCard: (p: React.ComponentProps<typeof real.OwnerApprovalCard>) => {
      cardProps.current?.(p);
      return <real.OwnerApprovalCard {...p} />;
    },
  };
});

const approveApproval = vi.fn();
const rejectApproval = vi.fn();
const confirmOrder = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    approveApproval: (id: string) => approveApproval(id) as unknown,
    rejectApproval: (id: string) => rejectApproval(id) as unknown,
    confirmOrder: (id: string) => confirmOrder(id) as unknown,
  },
}));

const { OwnerApprovalContainer } = await import('./OwnerApprovalContainer');

const W12000 = '12000000000000000000000';
const approval: OwnerApproval = {
  id: 'ap1',
  orderId: 'o1',
  reason: 'NEW_MERCHANT',
  store: '한상보쌈',
  amount: W12000,
  expiresAt: 1,
};
const quote = { orderId: 'o1', store: '한상보쌈', amount: W12000 } as unknown as OrderQuote;
const decision = (status: 'approved' | 'rejected'): ApprovalDecision => ({
  approval: { id: 'ap1', status },
  order: { id: 'o1', status: status === 'approved' ? 'quoted' : 'failed' },
  ...(status === 'approved' ? { quote } : {}),
});

function setup(props: { onQuote?: () => void; onRejected?: () => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onQuote = props.onQuote ?? vi.fn();
  const onRejected = props.onRejected ?? vi.fn();
  const view = render(
    <QueryClientProvider client={qc}>
      <OwnerApprovalContainer approval={approval} onQuote={onQuote} onRejected={onRejected} />
    </QueryClientProvider>,
  );
  return { onQuote, onRejected, qc, unmount: view.unmount };
}

beforeEach(() => {
  for (const f of [approveApproval, rejectApproval, confirmOrder]) f.mockReset();
  cardProps.current = null;
});

describe('OwnerApprovalContainer', () => {
  it('shows the store and the amount for a new store, with no Face ID step (no limit is raised)', () => {
    setup();
    expect(screen.getByText('처음 시키는 가게예요')).toBeInTheDocument();
    expect(screen.getByText('한상보쌈')).toBeInTheDocument();
    expect(screen.getByText('12,000원')).toBeInTheDocument();
    expect(screen.queryByText(/Face ID/)).toBeNull();
  });

  it('허락하기 approves once, hands the quote over to open the sheet, and never pays', async () => {
    approveApproval.mockResolvedValue(decision('approved'));
    const { onQuote, qc } = setup();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    await userEvent.dblClick(screen.getByRole('button', { name: '허락하기' }));
    await waitFor(() => {
      expect(onQuote).toHaveBeenCalledWith(quote);
    });
    expect(approveApproval).toHaveBeenCalledTimes(1);
    expect(approveApproval).toHaveBeenCalledWith('ap1');
    expect(rejectApproval).not.toHaveBeenCalled();
    expect(confirmOrder).not.toHaveBeenCalled();
    // The lists are asked again so the card and the history row move on.
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['approvals'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'] });
    });
  });

  it('안 시킬래요 rejects once and tells the parent; no quote is opened', async () => {
    rejectApproval.mockResolvedValue(decision('rejected'));
    const { onQuote, onRejected } = setup();
    await userEvent.click(screen.getByRole('button', { name: '안 시킬래요' }));
    await waitFor(() => {
      expect(onRejected).toHaveBeenCalledTimes(1);
    });
    expect(rejectApproval).toHaveBeenCalledWith('ap1');
    expect(approveApproval).not.toHaveBeenCalled();
    expect(onQuote).not.toHaveBeenCalled();
  });

  it('a failed answer says so and is not retried by itself; pressing again sends it again', async () => {
    approveApproval.mockRejectedValueOnce(new Error('offline'));
    approveApproval.mockResolvedValueOnce(decision('approved'));
    const { onQuote } = setup();
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    expect(await screen.findByText('답을 못 보냈어요. 다시 해 볼까요?')).toBeInTheDocument();
    expect(approveApproval).toHaveBeenCalledTimes(1);
    expect(onQuote).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    await waitFor(() => {
      expect(onQuote).toHaveBeenCalledTimes(1);
    });
    expect(approveApproval).toHaveBeenCalledTimes(2);
  });

  it('two quick answers before the next render send one request (card mocked)', async () => {
    approveApproval.mockReturnValue(new Promise(() => undefined));
    let props: { onApprove: () => void; onReject: () => void } | undefined;
    cardProps.current = (p) => {
      props = p;
    };
    setup();
    act(() => {
      props?.onApprove();
      props?.onApprove();
      props?.onReject();
    });
    await waitFor(() => {
      expect(approveApproval).toHaveBeenCalledTimes(1);
    });
    expect(rejectApproval).not.toHaveBeenCalled();
  });

  it('while the approval is on its way the other answer cannot be sent', async () => {
    approveApproval.mockReturnValue(new Promise(() => undefined));
    setup();
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    await userEvent.click(screen.getByRole('button', { name: '안 시킬래요' }));
    expect(rejectApproval).not.toHaveBeenCalled();
  });

  it('the sheet still opens when the answer takes the card away before it settles (QA 6 H1)', async () => {
    approveApproval.mockResolvedValue(decision('approved'));
    const { onQuote, qc, unmount } = setup();
    // The refetch that removes the card: the card is gone while the answer is still settling.
    vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => {
      unmount();
      return Promise.resolve();
    });
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    await waitFor(() => {
      expect(onQuote).toHaveBeenCalledWith(quote);
    });
  });

  it('a no is told to the parent even when the card is already gone', async () => {
    rejectApproval.mockResolvedValue(decision('rejected'));
    const { onRejected, qc, unmount } = setup();
    vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => {
      unmount();
      return Promise.resolve();
    });
    await userEvent.click(screen.getByRole('button', { name: '안 시킬래요' }));
    await waitFor(() => {
      expect(onRejected).toHaveBeenCalledTimes(1);
    });
  });
});
