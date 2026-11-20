// Mock data, one place for every screen (web.md "목 데이터"). Values and words are copied from
// design/screens (Main, Confirm, Done). Amounts are written in whole won and turned into aokrw
// strings here, the same way the server sends them.
import {
  aokrwToString,
  type BudgetView,
  getPolicy,
  okrwToAokrw,
  zBudgetView,
} from '@sikyeoyong/shared';
import type {
  ChatHistory,
  IdCardView,
  MeView,
  RecommendationCard,
  SignupConfig,
  WalletView,
} from '../api/types';

export const won = (n: bigint): string => aokrwToString(okrwToAokrw(n));

const policy = getPolicy('default');

export const ME: MeView = {
  dragonName: '용이',
  dragonSpecies: 'forest',
  level: 1,
  perOrderLimit: aokrwToString(policy.perOrderLimitAokrw[1]),
  custodial: true,
};

/** Main.dc.html: 210,000 / 300,000원 this month, 70% nag already sent. */
export const BUDGET: BudgetView = zBudgetView.parse({
  monthKst: '2026-11',
  personalBudget: won(300_000n),
  personalSpent: won(210_000n),
  nagLevel: 'warn70',
  chainCap: aokrwToString(policy.periodicCapAokrw),
  chainUsed: won(210_000n),
  chainResetAtSec: null,
  level: 1,
  perOrderLimit: ME.perOrderLimit,
  frozen: false,
  budgetOptions: policy.monthlyBudgetOptions.map((o) => ({
    id: o.id,
    amount: aokrwToString(o.amountAokrw),
  })),
});

/** Budget.dc.html: 100,000원 trial allowance. Kakao check until Mock KYC is switched on (D-16). */
export const SIGNUP: SignupConfig = { verifyMode: 'kakao', trialAllowance: won(100_000n) };

/** Main.dc.html recommendation card. */
export const RECOMMENDATIONS: readonly RecommendationCard[] = [
  {
    id: 'rec-gukbap',
    merchantId: 'maru-gukbap',
    menuId: 'pork-gukbap',
    store: '마루국밥 본점',
    etaMin: 25,
    menu: '돼지국밥',
    price: won(9_000n),
    needsApproval: false,
  },
  {
    id: 'rec-bunsik',
    merchantId: 'daecheong-bunsik',
    menuId: 'eomuk-gimbap',
    store: '대청분식',
    etaMin: 20,
    menu: '어묵탕과 김밥',
    price: won(8_500n),
    needsApproval: false,
  },
  {
    id: 'rec-bossam',
    merchantId: 'hansang-bossam',
    menuId: 'bossam-set',
    store: '한상보쌈',
    etaMin: 35,
    menu: '보쌈 정식',
    price: won(12_000n),
    needsApproval: true,
  },
];

/** Where the mock delivers (Confirm.dc.html, Done.dc.html). */
export const DESTINATION = '회사(역삼동)';

/** Per menu: the request and the dragon lines on Confirm and Done. */
export const MENU_EXTRA: Readonly<
  Record<string, { request?: string; confirmLine: string; cookingLine: string }>
> = {
  'pork-gukbap': {
    request: '깍두기 많이',
    confirmLine: '돼지국밥 시킬게용.\n이대로 괜찮아용?',
    cookingLine: '국밥 끓이는 중이에용.\n출발하면 알려 줄게용.',
  },
  'eomuk-gimbap': {
    confirmLine: '어묵탕과 김밥 시킬게용.\n이대로 괜찮아용?',
    cookingLine: '어묵탕 끓이는 중이에용.\n출발하면 알려 줄게용.',
  },
};

/** Main.dc.html conversation, started today 12:28 KST. */
export function chatHistory(now: number): ChatHistory {
  // 12:28 KST is 03:28 UTC on the same KST day.
  const kstDay = new Date(now + 9 * 3_600_000);
  const startedAt = Date.UTC(
    kstDay.getUTCFullYear(),
    kstDay.getUTCMonth(),
    kstDay.getUTCDate(),
    3,
    28,
  );
  return {
    startedAt,
    nextCursor: null,
    messages: [
      { id: 'm1', role: 'user', text: '점심 시켜 줘. 따뜻한 걸로' },
      {
        id: 'm2',
        role: 'dragon',
        events: [
          {
            type: 'token',
            text: '비 오니까 국물 어때용? 이번 달은 벌써 21만 원 썼으니까 조금 아껴서 골라 봤어용.',
          },
          { type: 'recommendations', items: [...RECOMMENDATIONS] },
          {
            type: 'quick_replies',
            items: [
              { id: 'q-gukbap', label: '돼지국밥으로' },
              { id: 'q-cheaper', label: '더 싼 거 없어?' },
            ],
          },
          { type: 'done', messageId: 'm2' },
        ],
      },
    ],
  };
}

/** Wallet.dc.html: 81,000 for the owner, 20,000 in the pocket, 32,000 saved this month. */
export const WALLET: WalletView = {
  owner: won(81_000n),
  pocket: won(20_000n),
  savedThisMonth: won(32_000n),
};

/** IdCard.dc.html: 이호재님의 배달 비서, 실명 확인됨, 2026. 12. 1. */
export const ID_CARD: IdCardView = {
  ownerName: '이호재',
  ownerVerified: true,
  bornAt: Date.parse('2026-12-01T00:00:00+09:00'),
};
