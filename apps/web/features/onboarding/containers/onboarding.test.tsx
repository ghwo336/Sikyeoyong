import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUDGET, ME, SIGNUP } from '../../../lib/mock/fixtures';
import {
  clearBudgetStepPending,
  isBudgetStepPending,
  markBudgetStepPending,
} from '../pending-budget';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));

// Reads come from the fixtures; every write is a spy.
const createAgent = vi.fn();
const verifyIdentity = vi.fn();
const setLimits = vi.fn();
const claimTrialAllowance = vi.fn();
const login = vi.fn();
const getAgentSetup = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    getBudget: () => Promise.resolve(BUDGET),
    getSignupConfig: () => Promise.resolve(SIGNUP),
    createAgent: (b: unknown) => createAgent(b) as unknown,
    verifyIdentity: () => verifyIdentity() as unknown,
    setLimits: (b: unknown) => setLimits(b) as unknown,
    claimTrialAllowance: () => claimTrialAllowance() as unknown,
    login: () => login() as unknown,
    getAgentSetup: () => getAgentSetup() as unknown,
    retryAgentSetup: () => Promise.resolve(),
  },
  // The direct login (mock or dev key); the vault path is lib/session/entry.test.ts.
  loginKind: 'direct',
}));

const { NameContainer } = await import('./NameContainer');
const { BudgetSetupContainer } = await import('./BudgetSetupContainer');
const { VerifyContainer } = await import('./VerifyContainer');
const { StartContainer } = await import('./StartContainer');
const { HatchContainer } = await import('./HatchContainer');

const won = (n: bigint) => okrwToAokrw(n).toString();

function wrap(ui: ReactNode, qc = newClient()) {
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

beforeEach(() => {
  for (const f of [
    push,
    replace,
    createAgent,
    verifyIdentity,
    setLimits,
    claimTrialAllowance,
    login,
    getAgentSetup,
  ]) {
    f.mockReset();
  }
});

describe('NameContainer', () => {
  it('draws the Name design: back, step 2 of 3, title, and the level 1 line under the field', async () => {
    wrap(<NameContainer />);
    expect(screen.getByRole('progressbar', { name: '3단계 중 2단계' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '알을 하나 골라이름을 지어 주세요',
    );
    expect(screen.getByRole('textbox', { name: '이름' })).toHaveAccessibleDescription(
      '처음엔 한 번에 10,000원까지. 깨어나면 바꿀 수 있어요.',
    );
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(replace).toHaveBeenCalledExactlyOnceWith('/verify');
  });

  it.each(['', '   '])('an empty name (%j) explains and does not hatch', async (typed) => {
    wrap(<NameContainer />);
    const field = screen.getByRole('textbox', { name: '이름' });
    await userEvent.clear(field);
    if (typed !== '') await userEvent.type(field, typed);
    await userEvent.click(screen.getByRole('button', { name: '알 깨우기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('이름을 지어 주세요');
    expect(createAgent).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('hatches once with the trimmed name and the picked egg', async () => {
    localStorage.clear();
    createAgent.mockResolvedValue({ agent: { id: 'a1', status: 'PENDING' } });
    wrap(<NameContainer />);
    const field = screen.getByRole('textbox', { name: '이름' });
    await userEvent.clear(field);
    await userEvent.type(field, '  봄봄 ');
    await userEvent.click(screen.getByRole('button', { name: '알 깨우기' }));
    expect(createAgent).toHaveBeenCalledTimes(1);
    expect(createAgent).toHaveBeenCalledWith({ dragonName: '봄봄', dragonSpecies: 'forest' });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/hatch');
    });
    // The sign-up is under way: the limits step follows the hatch (QA 6 L1).
    expect(isBudgetStepPending()).toBe(true);
  });

  it('paints the app in the picked egg at once, and remembers it only once saved (D-32)', async () => {
    localStorage.clear();
    createAgent.mockResolvedValue({ agent: { id: 'a1', status: 'PENDING' } });
    wrap(<NameContainer />);
    expect(document.documentElement.dataset.species).toBe('forest');
    await userEvent.click(screen.getByRole('radio', { name: /물/ }));
    expect(document.documentElement.dataset.species).toBe('water');
    expect(localStorage.getItem('sikyeoyong.species')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '알 깨우기' }));
    await waitFor(() => {
      expect(localStorage.getItem('sikyeoyong.species')).toBe('water');
    });
    expect(createAgent).toHaveBeenCalledWith({ dragonName: '용이', dragonSpecies: 'water' });
  });
});

describe('BudgetSetupContainer', () => {
  beforeEach(() => {
    markBudgetStepPending();
  });

  it('sends an onboarded owner to the dragon screen instead of sign-up (QA 3)', async () => {
    clearBudgetStepPending();
    wrap(<BudgetSetupContainer />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/dragon');
    });
    expect(screen.queryByText(/안녕하세용/)).toBeNull();
  });

  it('sends both picked limits as aokrw strings, once (D-31)', async () => {
    setLimits.mockResolvedValue(undefined);
    wrap(<BudgetSetupContainer />);
    const more = await screen.findByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await userEvent.click(more);
    await userEvent.click(more);
    await userEvent.click(screen.getByRole('button', { name: '30일에 쓸 돈 10,000원 내리기' }));
    await userEvent.click(screen.getByRole('button', { name: '용이랑 시작하기' }));
    expect(setLimits).toHaveBeenCalledTimes(1);
    expect(setLimits).toHaveBeenCalledWith({
      perOrderLimit: won(20_000n),
      myPeriodicLimit: won(50_000n),
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('keeps 30 days at or above one order: raising one order carries it up (D-31)', async () => {
    setLimits.mockResolvedValue(undefined);
    wrap(<BudgetSetupContainer />);
    const less = await screen.findByRole('button', { name: '30일에 쓸 돈 10,000원 내리기' });
    // Down to the floor: 10,000, the same as one order now (pressing at the end does nothing).
    for (let i = 0; i < 8; i += 1) await userEvent.click(less);
    if (!(less as HTMLButtonElement).disabled) await userEvent.click(less);
    expect(less).toHaveAttribute('aria-disabled', 'true');
    const more = screen.getByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' });
    await userEvent.click(more);
    await userEvent.click(more);
    // One order is 20,000 now, so 30 days became 20,000 and still cannot go lower.
    expect(less).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: '용이랑 시작하기' }));
    expect(setLimits).toHaveBeenCalledWith({
      perOrderLimit: won(20_000n),
      myPeriodicLimit: won(20_000n),
    });
  });

  it('sends only what changed, and nothing when nothing did', async () => {
    setLimits.mockResolvedValue(undefined);
    wrap(<BudgetSetupContainer />);
    await userEvent.click(await screen.findByRole('button', { name: '용이랑 시작하기' }));
    expect(setLimits).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('takes the trial allowance once, however often 받기 is pressed', async () => {
    let finish: () => void = () => undefined;
    claimTrialAllowance.mockReturnValue(
      new Promise<void>((r) => {
        finish = r;
      }),
    );
    wrap(<BudgetSetupContainer />);
    const take = await screen.findByRole('button', { name: '받기' });
    await userEvent.click(take);
    await userEvent.click(take);
    expect(take).toHaveAttribute('aria-busy', 'true');
    finish();
    // After it arrived the button is gone, so it cannot be asked for again.
    expect(await screen.findByText('받았어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '받기' })).toBeNull();
    expect(claimTrialAllowance).toHaveBeenCalledTimes(1);
  });

  it('greets with the dragon at its stage and shows the trial allowance amount', async () => {
    const { container } = wrap(<BudgetSetupContainer />);
    expect(await screen.findByText('100,000원')).toBeInTheDocument();
    // 10,000 at once is stage 1; 15,000 grows it to stage 2 (D-31).
    expect(container.querySelector('[data-stage="1"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' }));
    expect(container.querySelector('[data-stage="2"]')).not.toBeNull();
  });
});

describe('VerifyContainer', () => {
  it('draws the Verify design: back, step 1 of 3 and the title', async () => {
    wrap(<VerifyContainer />);
    expect(screen.getByRole('progressbar', { name: '3단계 중 1단계' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '주인님이 누군지한 번만 확인할게요',
    );
    expect(await screen.findByText('실명 확인된 주인만 비서를 둘 수 있어요.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(replace).toHaveBeenCalledExactlyOnceWith('/start');
  });

  it('goes on to naming only when verified', async () => {
    verifyIdentity.mockResolvedValue({ verified: false });
    wrap(<VerifyContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /본인 인증/ }));
    await waitFor(() => {
      expect(verifyIdentity).toHaveBeenCalledTimes(1);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(push).not.toHaveBeenCalled();
  });

  it('verified moves to /name', async () => {
    verifyIdentity.mockResolvedValue({ verified: true });
    wrap(<VerifyContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /본인 인증/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/name');
    });
  });
});

describe('StartContainer', () => {
  it('draws the Start design: the forest egg, the title and the one start button (D-29)', async () => {
    login.mockResolvedValue(undefined);
    const { container } = wrap(<StartContainer />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('배달은용이한테 시켜용');
    expect(container.querySelector('svg[data-species="forest"][width="168"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /카카오로 시작하기/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '이메일로 시작하기' }));
    expect(login).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });
});

describe('StartContainer when the start fails', () => {
  it('says so in one line instead of doing nothing, and the button works again', async () => {
    login.mockRejectedValueOnce(new Error('POUCHI_EMBEDDED_REQUEST_INVALID'));
    wrap(<StartContainer />);
    await userEvent.click(screen.getByRole('button', { name: '이메일로 시작하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('시작하지 못했어요');
    expect(push).not.toHaveBeenCalled();
    login.mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole('button', { name: '이메일로 시작하기' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });
});

describe('StartContainer and the me cache', () => {
  it('a login drops the signed-out answer kept from before, so the front door asks again', async () => {
    login.mockResolvedValue(undefined);
    const qc = newClient();
    qc.setQueryData(['me'], { stale: 'signed out' });
    qc.setQueryData(['identity'], { verified: true }); // someone else's answer in this tab
    wrap(<StartContainer />, qc);
    await userEvent.click(screen.getByRole('button', { name: '이메일로 시작하기' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
    expect(qc.getQueryState(['me'])).toBeUndefined();
    expect(qc.getQueryState(['identity'])).toBeUndefined();
  });
});

describe('VerifyContainer and the identity cache', () => {
  it('passing the check drops the old "not verified" answer, so the front door does not send back to Verify', async () => {
    verifyIdentity.mockResolvedValue({ verified: true });
    const qc = newClient();
    qc.setQueryData(['identity'], { verified: false });
    wrap(<VerifyContainer />, qc);
    await userEvent.click(await screen.findByRole('button', { name: /본인 인증/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/name');
    });
    expect(qc.getQueryState(['identity'])).toBeUndefined();
  });
});

describe('HatchContainer', () => {
  const steps = (s: readonly [string, string, string]) =>
    (['wallet', 'identity', 'limit'] as const).map((key, i) => ({ key, status: s[i] }));

  it('draws the hatch words and step labels while PENDING, and stays', async () => {
    getAgentSetup.mockResolvedValue({
      status: 'PENDING',
      steps: steps(['done', 'doing', 'waiting']),
    });
    wrap(<HatchContainer />);
    expect(
      await screen.findByRole('heading', { level: 1, name: '알이 흔들려용...' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1~3분 걸려요. 다 되면 알려 드릴게요.')).toBeInTheDocument();
    for (const label of [
      '용이 용돈 주머니 만들기',
      '용이 신분증 만들기',
      '한 번에 쓸 수 있는 돈 새기기',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(replace).not.toHaveBeenCalled();
  });

  it('with all three steps done the title no longer wobbles, and with any left it does', async () => {
    getAgentSetup.mockResolvedValue({
      status: 'PENDING',
      steps: steps(['done', 'done', 'done']),
    });
    const { unmount } = wrap(<HatchContainer />);
    expect(
      await screen.findByRole('heading', { level: 1, name: '다 됐어용!' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('알이 흔들려용...')).toBeNull();
    expect(screen.queryByText(/1~3분 걸려요/)).toBeNull();
    unmount();
    getAgentSetup.mockResolvedValue({
      status: 'PENDING',
      steps: steps(['done', 'done', 'doing']),
    });
    wrap(<HatchContainer />);
    expect(
      await screen.findByRole('heading', { level: 1, name: '알이 흔들려용...' }),
    ).toBeInTheDocument();
  });

  it('moves on to /budget once the dragon it watched hatching is up', async () => {
    localStorage.clear();
    getAgentSetup
      .mockResolvedValueOnce({ status: 'PENDING', steps: steps(['done', 'doing', 'waiting']) })
      .mockResolvedValue({ status: 'ACTIVE', steps: steps(['done', 'done', 'done']) });
    wrap(<HatchContainer />);
    await waitFor(
      () => {
        expect(replace).toHaveBeenCalledWith('/budget');
      },
      { timeout: 4000 },
    );
    expect(isBudgetStepPending()).toBe(true);
  });

  it('a dragon already up on the first read still gets the limits step when Name made it (QA 6 L1)', async () => {
    localStorage.clear();
    getAgentSetup.mockResolvedValue({ status: 'ACTIVE', steps: steps(['done', 'done', 'done']) });
    markBudgetStepPending(); // what Name leaves after the create
    wrap(<HatchContainer />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/budget');
    });
  });

  it('does not bring back the sign-up budget for an owner already set up', async () => {
    localStorage.clear();
    getAgentSetup.mockResolvedValue({ status: 'ACTIVE', steps: steps(['done', 'done', 'done']) });
    wrap(<HatchContainer />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
    expect(isBudgetStepPending()).toBe(false);
    expect(replace).not.toHaveBeenCalledWith('/budget');
  });
});
