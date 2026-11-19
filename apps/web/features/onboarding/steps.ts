import { formatOkrw, getPolicy } from '@sikyeoyong/shared';
import type { AgentSetupStepKey } from '../../lib/api';

/** The three sign-up steps on the top bar (Verify, Name, Budget). Names are for screen readers. */
export const SIGNUP_STEPS = ['본인 인증', '알 고르기', '예산'] as const;

/**
 * Name.dc.html line under the name field. Every dragon is born at level 1; its per-order limit is
 * the shared policy value (the same in every policy profile), so the words follow the policy.
 */
export const BORN_LINE = `레벨 1로 태어나요. 한 번에 ${formatOkrw(getPolicy('default').perOrderLimitAokrw[1])}까지.`;

/** Hatch.dc.html step labels. */
export const HATCH_LABEL: { readonly [K in AgentSetupStepKey]: string } = {
  wallet: '용이 용돈 주머니 만들기',
  identity: '용이 신분증 만들기',
  limit: '한 번에 쓸 수 있는 돈 새기기',
};

/** "용이예용", "봄봄이에용": the copula after the dragon's name follows the last syllable. */
export function nameIs(name: string): string {
  const last = name.codePointAt(name.length - 1) ?? 0;
  const hangul = last >= 0xac00 && last <= 0xd7a3;
  const hasFinal = hangul && (last - 0xac00) % 28 !== 0;
  return `${name}${hasFinal ? '이에용' : '예용'}`;
}
