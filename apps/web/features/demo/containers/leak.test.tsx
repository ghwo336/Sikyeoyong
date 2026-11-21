import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEAK_COMPARE } from '../../../lib/mock/fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const getLeakCompare = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: { getLeakCompare: () => getLeakCompare() as unknown },
}));

const { LeakCompareContainer } = await import('./LeakCompareContainer');
const { LeakEntryContainer } = await import('./LeakEntryContainer');

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  getLeakCompare.mockReset();
  getLeakCompare.mockResolvedValue(LEAK_COMPARE);
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('LeakCompareContainer (LeakCompare.dc.html)', () => {
  it('draws the real numbers from the API as won (bigint through formatOkrw)', async () => {
    wrap(<LeakCompareContainer />);
    expect(await screen.findByText('10,000원까지만')).toBeTruthy();
    expect(screen.getByText('1시간 동안 다 합쳐서 최대 60,000원까지')).toBeTruthy();
    expect(screen.getByText('20,100원만')).toBeTruthy();
    expect(screen.getByText('지금 주머니에 20,000원')).toBeTruthy();
  });

  it('follows the numbers the API sends, past Number range', async () => {
    getLeakCompare.mockResolvedValue({
      ...LEAK_COMPARE,
      floatAtRisk: okrwToAokrw(90_071_992_547_409_931n).toString(),
    });
    wrap(<LeakCompareContainer />);
    expect(await screen.findByText('90,071,992,547,409,931원만')).toBeTruthy();
  });

  it('shows the exact rule 11 line only when 자세히 보기 is on', async () => {
    wrap(<LeakCompareContainer />);
    await screen.findByText('10,000원까지만');
    expect(screen.queryByText(/float만 잃는다/)).toBeNull();
  });

  it('shows the exact rule 11 line with 자세히 보기 on', async () => {
    localStorage.setItem('sikyeoyong.details', 'on');
    wrap(<LeakCompareContainer />);
    const line = await screen.findByText(
      /주문 경로의 큰돈은 체인이 막고, 우회 경로로는 float만 잃는다/,
    );
    // Inside a closed 자세히 보기, not open on the page (QA 6 M5).
    expect(line.closest('details')?.hasAttribute('open')).toBe(false);
  });

  it('says one plain line when the numbers cannot be loaded (demo off on the API)', async () => {
    getLeakCompare.mockRejectedValue(new Error('404'));
    wrap(<LeakCompareContainer />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('못 불러왔어요. 다시 열어 볼까요?');
    });
    expect(screen.queryByText(/원/)).toBeNull();
  });

  it('goes back to the wallet', async () => {
    wrap(<LeakCompareContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /뒤로|돌아가기/ }));
    expect(push).toHaveBeenCalledWith('/dragon');
  });
});

describe('LeakEntryContainer', () => {
  it('draws nothing in a normal build', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
    const { container } = render(<LeakEntryContainer />);
    expect(container.textContent).toBe('');
  });

  it('is one quiet row to the comparison in a demo build', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    render(<LeakEntryContainer />);
    await userEvent.click(screen.getByRole('button', { name: /열쇠를 도둑맞았다면/ }));
    expect(push).toHaveBeenCalledWith('/demo/leak');
  });
});
