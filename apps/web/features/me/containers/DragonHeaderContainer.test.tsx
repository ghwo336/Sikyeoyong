import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppError, aokrwToString, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { ME } from '../../../lib/mock/fixtures';

const push = vi.fn();
const failing = vi.hoisted(() => ({ me: false }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('../../../lib/api', () => ({
  // Not the design value (10,000원), so a hard-coded caption cannot pass.
  api: {
    getMe: () =>
      failing.me
        ? Promise.reject(new AppError('UNAUTHENTICATED', 'no session'))
        : Promise.resolve({
            ...ME,
            dragonName: '봄봄',
            dragonSpecies: 'water',
            perOrderLimit: aokrwToString(okrwToAokrw(35_000n)),
          }),
  },
}));

const { DragonHeaderContainer } = await import('./DragonHeaderContainer');

describe('DragonHeaderContainer', () => {
  it('shows the dragon from /me with its limit line and opens settings', async () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DragonHeaderContainer />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: '봄봄' })).toBeInTheDocument();
    expect(screen.getByText('한 번에 35,000원까지')).toBeInTheDocument();
    expect(container.querySelector('svg[data-species="water"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '봄봄 설정' }));
    expect(push).toHaveBeenCalledWith('/dragon');
  });

  it('draws the header shape while /me loads, then swaps it for the real header (D-23)', async () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DragonHeaderContainer />
      </QueryClientProvider>,
    );
    expect(container.querySelector('[data-shape="chatHeader"]')).not.toBeNull();
    await screen.findByRole('heading', { level: 1, name: '봄봄' });
    expect(container.querySelector('[data-shape="chatHeader"]')).toBeNull();
  });

  it('the receipt button opens the order history (Main.dc.html 주문 내역)', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <DragonHeaderContainer />
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: '주문 내역' }));
    expect(push).toHaveBeenCalledWith('/orders');
  });

  it('a failed /me leaves the header out instead of a shape that waits forever (D-23)', async () => {
    failing.me = true;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DragonHeaderContainer />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(qc.getQueryState(['me'])?.status).toBe('error');
    });
    expect(container.querySelector('[data-shape]')).toBeNull();
    failing.me = false;
  });
});
