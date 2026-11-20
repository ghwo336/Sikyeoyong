import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUDGET, ID_CARD, ME, WALLET } from '../../../lib/mock/fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const getWallet = vi.fn();
const getBudget = vi.fn();
const getMe = vi.fn();
const setFrozen = vi.fn();
const refundPocket = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => getMe() as unknown,
    getBudget: () => getBudget() as unknown,
    getWallet: () => getWallet() as unknown,
    getIdCard: () => Promise.resolve(ID_CARD),
    setFrozen: (f: boolean) => setFrozen(f) as unknown,
    refundPocket: () => refundPocket() as unknown,
  },
}));

const { AllowanceContainer } = await import('./AllowanceContainer');
const { LimitRowsContainer } = await import('./LimitRowsContainer');
const { DragonControlsContainer } = await import('./DragonControlsContainer');
const { CustodyNoteContainer } = await import('./CustodyNoteContainer');
const { FrozenContainer } = await import('./FrozenContainer');
const { IdCardContainer } = await import('./IdCardContainer');

const won = (n: bigint) => okrwToAokrw(n).toString();

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  for (const f of [push, getWallet, getBudget, getMe, setFrozen, refundPocket]) f.mockReset();
  getMe.mockResolvedValue(ME);
  getBudget.mockResolvedValue(BUDGET);
  getWallet.mockResolvedValue(WALLET);
  setFrozen.mockResolvedValue(undefined);
  refundPocket.mockResolvedValue(undefined);
  localStorage.clear();
});

describe('Wallet screen (Wallet.dc.html)', () => {
  it('draws the design numbers: allowance, pocket, limits, budget, saved', async () => {
    wrap(
      <>
        <AllowanceContainer />
        <LimitRowsContainer />
      </>,
    );
    expect(await screen.findByText('81,000원')).toBeInTheDocument();
    expect(screen.getByText('용이 주머니에 20,000원')).toBeInTheDocument();
    expect(await screen.findByText('한 번에 쓸 수 있는 돈')).toBeInTheDocument();
    expect(screen.getByText('10,000원')).toBeInTheDocument();
    expect(screen.getByText('300,000원')).toBeInTheDocument();
    expect(await screen.findByText('32,000원')).toBeInTheDocument();
  });

  it('shows no made-up balance when the server has no wallet (the row is just absent)', async () => {
    getWallet.mockRejectedValue(new AppError('INTERNAL'));
    wrap(
      <>
        <AllowanceContainer />
        <LimitRowsContainer />
      </>,
    );
    expect(await screen.findByText('이번 달 예산')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('주인님 용돈')).toBeNull();
    });
    expect(screen.queryByText('이번 달 아낀 돈')).toBeNull();
  });

  it('the pause switch pauses and opens the sleeping screen; it never pays', async () => {
    wrap(<DragonControlsContainer />);
    await userEvent.click(await screen.findByRole('switch', { name: '용이 멈추기' }));
    expect(setFrozen).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dragon/frozen');
    });
  });

  it('the ID row opens the ID card', async () => {
    wrap(<DragonControlsContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /용이 신분증/ }));
    expect(push).toHaveBeenCalledWith('/dragon/id');
  });

  it('자세히 보기 is remembered on this device and turns the trial line into the exact one', async () => {
    wrap(
      <>
        <DragonControlsContainer />
        <CustodyNoteContainer />
      </>,
    );
    expect(
      await screen.findByText('체험판이에요. 용이 용돈은 지금 시켜용이 대신 맡아 두고 있어요.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: '자세히 보기' }));
    expect(
      await screen.findByText(/테스트넷 데모\. 에이전트 키와 소유자 권한/),
    ).toBeInTheDocument();
    expect(localStorage.getItem('sikyeoyong.details')).toBe('on');
  });

  it('no trial line once the owner holds the rights (custodial false)', async () => {
    getMe.mockResolvedValue({ ...ME, custodial: false });
    wrap(<CustodyNoteContainer />);
    await waitFor(() => {
      expect(getMe).toHaveBeenCalled();
    });
    expect(screen.queryByText(/체험판이에요/)).toBeNull();
  });
});

describe('ID card and the sleeping dragon', () => {
  it('draws the ID card from the owner and the dragon', async () => {
    wrap(<IdCardContainer />);
    expect(await screen.findByText(/이호재님의 배달 비서/)).toBeInTheDocument();
  });

  it('돌려받기 takes the pocket back; 깨우기 wakes and goes to the chat', async () => {
    getWallet.mockResolvedValue({ ...WALLET, pocket: won(20_000n) });
    wrap(<FrozenContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /돌려받기/ }));
    expect(refundPocket).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /깨우기/ }));
    expect(setFrozen).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });
});
