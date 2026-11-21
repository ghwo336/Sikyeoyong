/**
 * What the dragon said earlier about an approval, a quote or an order was true then, not now
 * (D-34 follow-up: it kept saying "승인 요청은 진행 중이라 기다리고 있는 중이용" long after).
 * The model sees its earlier turns as plain words, so those sentences are dropped from them:
 * any state it states this turn must come from a read tool called this turn (get_order_history).
 */
const STATE_WORDS = /승인|허락|견적|확인 카드|결제|주문|배달|도착|출발|끓이는|만드는 중|기다리고/;

/** Sentences end at . ! ? or a line break; the terminator stays with its sentence. */
const SENTENCE = /[^.!?\n]*[.!?\n]+[ \t]*|[^.!?\n]+$/g;

/** An earlier dragon turn's words without the sentences that state an order's or approval's state. */
export function stripStaleState(text: string): string {
  return (text.match(SENTENCE) ?? []).filter((s) => !STATE_WORDS.test(s)).join('');
}
