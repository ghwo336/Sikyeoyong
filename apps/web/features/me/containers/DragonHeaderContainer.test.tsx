import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aokrwToString, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { ME } from '../../../lib/mock/fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('../../../lib/api', () => ({
  // Not the design value (10,000원), so a hard-coded caption cannot pass.
  api: {
    getMe: () =>
      Promise.resolve({
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
});
