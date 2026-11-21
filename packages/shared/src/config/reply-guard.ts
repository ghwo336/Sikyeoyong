/**
 * The dragon's reply guard numbers (D-35, security.md "프롬프트 인젝션"). One place, so the
 * runtime, the providers and the tests agree. The reply is short delivery talk, so a long
 * answer is already off scope.
 */

/** Longest visible reply in characters (one model turn's text). */
export const REPLY_MAX_CHARS = 300;

/**
 * Per model turn output ceiling. A reply is at most 300 characters and the longest tool input
 * (a place_order with ten lines and a note) is a few hundred tokens, so 2048 leaves room for
 * thinking too. A tool call cut at this ceiling never runs (runtime rejects max_tokens).
 */
export const REPLY_MAX_OUTPUT_TOKENS = 2048;

/** What the user sees instead of a reply that did not pass the guard. */
export const SCOPE_LINE = '저는 배달만 도와드릴 수 있어용. 뭐 먹고 싶은지 말해 주세용.';

/** The topic judge must answer within this, or the reply is blocked (fail closed). */
export const REPLY_JUDGE_TIMEOUT_MS = 5_000;
/** The judge answers one word. */
export const REPLY_JUDGE_MAX_OUTPUT_TOKENS = 16;
