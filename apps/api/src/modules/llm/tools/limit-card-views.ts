import {
  type AmountRange,
  aokrwToString,
  type BudgetView,
  formatOkrw,
  isInRange,
  type LimitField,
  parseAokrw,
  type PolicyConfig,
} from '@sikyeoyong/shared';
import { ToolReply } from './tool-reply.js';

/** The screen's words for each limit (D-31). Never 레벨. */
const FIELD_WORDS: Record<LimitField, string> = {
  perOrder: '한 번에 쓸 돈',
  myPeriodic: '30일에 쓸 돈',
};

/**
 * propose_limit_change's two faces (D-21, D-31). The model only names the field and the amount
 * the user said; the server checks it and makes the card's before and after and its rows from
 * the owner's current limits. Nothing changes here: the card's button does that
 * (PUT /agents/me/limits, CLAUDE.md rule 3). No card when the amount is not one the owner may
 * pick (range and step) or equals the current one; the model then hears why, in display words.
 * The intent gate (the user's own words) runs before this, in the runtime.
 */
export function limitCardReply(
  policy: PolicyConfig,
  view: BudgetView,
  input: { field: LimitField; amountAokrw: bigint },
  cardId: string,
): unknown {
  const range: AmountRange =
    input.field === 'perOrder' ? policy.perOrderLimit : policy.myPeriodicLimit;
  const from = parseAokrw(input.field === 'perOrder' ? view.perOrderLimit : view.myPeriodicLimit);
  const label = FIELD_WORDS[input.field];
  if (!isInRange(range, input.amountAokrw)) {
    return {
      status: 'NO_CARD',
      reason: 'OUT_OF_RANGE',
      field: label,
      min: formatOkrw(range.minAokrw),
      max: formatOkrw(range.maxAokrw),
      step: formatOkrw(range.stepAokrw),
    };
  }
  if (input.amountAokrw === from) {
    return { status: 'NO_CARD', reason: 'SAME_AS_NOW', field: label, now: formatOkrw(from) };
  }
  const other: LimitField = input.field === 'perOrder' ? 'myPeriodic' : 'perOrder';
  const otherNow = parseAokrw(other === 'perOrder' ? view.perOrderLimit : view.myPeriodicLimit);
  const raise = input.amountAokrw > from;
  return new ToolReply(
    {
      status: 'LIMIT_CARD_SHOWN',
      changed: false,
      field: label,
      from: formatOkrw(from),
      to: formatOkrw(input.amountAokrw),
      next: '사용자가 카드의 버튼을 눌러야 바뀐다',
    },
    {
      type: 'limit_change_card',
      card: {
        cardId,
        field: input.field,
        from: aokrwToString(from),
        to: aokrwToString(input.amountAokrw),
        // Raising either limit asks the owner again; lowering does not (D-28, D-31).
        needsReauth: raise,
        rows: [{ label: FIELD_WORDS[other], value: `${formatOkrw(otherNow)} 그대로` }],
      },
    },
  );
}
