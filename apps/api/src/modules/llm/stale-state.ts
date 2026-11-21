/**
 * What the dragon said earlier about where an approval, a quote or an order stands was true
 * then, not now (it kept saying "승인 요청은 진행 중이라 기다리고 있는 중이용" long after). Only
 * such status claims are dropped from its earlier turns; the model sees only the current session
 * (D-34), so its proposals and questions ("돼지국밥으로 주문할까용?") stay: the user's next "응"
 * needs them. Any status it states this turn must come from get_order_history this turn.
 */
const STATUS_CLAIM = new RegExp(
  [
    // waiting or in progress
    '(승인|허락|견적|결제|주문|배달)[^.!?\\n]*(대기|기다리|진행\\s?중|중이)',
    '(끓이는|만드는|준비|배달|조리)\\s?중',
    // done or arrived
    '(결제|주문|승인|허락)[^.!?\\n]*(됐|되었|했어|했네|넣었|접수|완료|통과)',
    '(도착|출발)(했|해용|해요|할게|이에용)',
    '(견적)[^.!?\\n]*(만들었|뽑았|나왔)',
  ].join('|'),
);

/** Sentences end at . ! ? or a line break; the terminator stays with its sentence. */
const SENTENCE = /[^.!?\n]*[.!?\n]+[ \t]*|[^.!?\n]+$/g;

/** A sentence that asks or offers ("~할까용?", "~해 주세용") is not a status claim. */
function isOffer(s: string): boolean {
  return /\?\s*$/.test(s.trim()) || /(할까|볼까|드릴까|해\s?주세|해\s?볼게|할게)/.test(s);
}

/** An earlier dragon turn's words without the sentences that report an order's or approval's status. */
export function stripStaleState(text: string): string {
  return (text.match(SENTENCE) ?? []).filter((s) => isOffer(s) || !STATUS_CLAIM.test(s)).join('');
}
