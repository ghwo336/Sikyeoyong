/**
 * The dragon never says an approval was asked for, given or decided in its own words: the
 * server owns that fact (agent-runtime.md "허락 대기") and says it itself. Browser QA 5 still
 * showed "승인 요청은 보냈어용 ... 승인해 주셨어용" when the model said it before any tool result,
 * in a later message, or after request_owner_approval answered NO_APPROVAL_NEEDED. So the
 * runtime drops any sentence that reports an approval or permission outcome, whatever the
 * turn. "승인이 필요해용" (a reason, no outcome) stays.
 */

/**
 * A sentence that talks about 승인/허락 and reports it as done: sent, asked, received, given or
 * finished (past tense or a result). Intentions and questions ("요청해 볼게용", "보내 드릴까용?",
 * "승인되면 알려드릴게용") are not claims and stay.
 */
const CLAIM = new RegExp(
  '(승인|허락)[^.!?\\n]*' +
    '(보냈|했|드렸|구했|올렸|받았|받으셨|받아\\s?왔|주셨|해\\s?줬|됐|되었|' +
    '완료(?!\\s?(되면|하면|되는|될|해\\s?주))|처리됐|떨어졌|왔|갔|나왔|났어|끝났|도착했|' +
    '전달됐|전달했|전송됐|전송했|발송됐|발송했|통과됐|통과했|' +
    '놨|넣었|넣어\\s?(?:뒀|두었)|날렸|쏘았|쐈|보내졌|통과(?:예용|예요|이에요)|' +
    '(?:보내|올려|날려|넣어)\\s?(?:뒀|두었)|보내져\\s?있|' +
    '(?:OK|ok|오케이|끝)\\s?(?:이에용|이에요|예용|예요|이야|이다|임)?[용요야]?(?=\\s*[!.~]*\\s*$)|' +
    '(?:됨|둠)(?=\\s*[!.?~]*\\s*$))' +
    // "보냈는지 볼게용" asks or plans a check; it reports nothing.
    '(?!\\s?[는은]지)',
);

/** Sentences end at . ! ? or a line break; the terminator stays with its sentence. */
const SENTENCE = /[^.!?\n]*[.!?\n]+[ \t]*|[^.!?\n]+$/g;

export function isApprovalClaim(sentence: string): boolean {
  return CLAIM.test(sentence);
}

/** Splits into sentences and drops the ones that claim an approval outcome. */
export function stripApprovalClaims(text: string): { text: string; dropped: boolean } {
  let dropped = false;
  const kept = (text.match(SENTENCE) ?? []).filter((s) => {
    if (!isApprovalClaim(s)) return true;
    dropped = true;
    return false;
  });
  return { text: kept.join(''), dropped };
}

/**
 * Streams model text sentence by sentence: a sentence is judged once it is whole, so a claim
 * split across two pieces cannot slip through. flush() judges the unfinished tail at the end of
 * a turn.
 */
export class ApprovalClaimScreen {
  private buf = '';
  dropped = false;

  push(piece: string): string {
    this.buf += piece;
    const end = Math.max(
      this.buf.lastIndexOf('.'),
      this.buf.lastIndexOf('!'),
      this.buf.lastIndexOf('?'),
      this.buf.lastIndexOf('\n'),
    );
    if (end < 0) return '';
    const whole = this.buf.slice(0, end + 1);
    this.buf = this.buf.slice(end + 1);
    return this.judge(whole);
  }

  flush(): string {
    const rest = this.buf;
    this.buf = '';
    return this.judge(rest);
  }

  private judge(text: string): string {
    const r = stripApprovalClaims(text);
    if (r.dropped) this.dropped = true;
    return r.text;
  }
}
