import { REPLY_MAX_CHARS } from '@sikyeoyong/shared';

/**
 * Rule check of the dragon's visible reply (D-35 layer 1). Pure and cheap: it runs on every
 * reply, whatever the model was told. The reason is a fixed word, never the user's or the
 * model's text, so it is safe to log.
 */
export type RuleFailure = 'TOO_LONG' | 'CODE' | 'LIST' | 'FORBIDDEN_WORD' | 'ADDRESS' | 'TONE';

/** D-17: the user's screen has no blockchain talk. Also the model's own internals. */
const FORBIDDEN =
  /지갑|토큰|트랜잭션|블록\s?체인|가스\s?비|스마트\s?컨트랙트|프라이빗\s?키|니모닉|시드\s?구문|시스템\s?프롬프트|프롬프트|\b(?:kyc|pcl|wallet|token|transaction|blockchain|prompt)\b/i;

/** The dragon calls the user 주인님 and never 당신, 고객님 or 사용자님. */
const WRONG_ADDRESS = /당신|고객님|사용자님|손님|\byou\b/i;

const CODE_FENCE = /```|~~~/;
const CODE_LINE =
  /^\s*(?:import\s|from\s+\S+\s+import\s|def\s|class\s|function\s|const\s|let\s|var\s|#include|public\s+static|<\?php|SELECT\s.+\sFROM\s|<\/?[a-z][a-z0-9]*[^>]*>|\$\s?[a-z])/im;
const CODE_PUNCT_LINE = /[{};]\s*$/gm;
const LIST_LINE = /^\s*(?:[-*•]|\d+[.)])\s+\S/gm;

/** Sentences end at . ! ? … or a line break. */
const SPLIT = /[.!?…\n]+/;
/** Trailing marks that do not count as the last letter: punctuation, emoji, ~, quotes, jamo laughs. */
const TAIL_NOISE = /[^\p{L}\p{N}]+$|[ㄱ-ㅣ]+$/u;

function lastLetters(sentence: string): string {
  let s = sentence.trim();
  for (let i = 0; i < 4; i += 1) {
    const next = s.replace(TAIL_NOISE, '').trimEnd();
    if (next === s) break;
    s = next;
  }
  return s;
}

const HANGUL = /[가-힣]/;

/**
 * What the tone rule reads: quoted words, parentheses and list numbers are not the dragon's
 * sentence ends, and a "." between digits is a decimal ("1.2km", "4.5점"), so none of them may
 * cut or end a sentence.
 */
function toneText(text: string): string {
  return text
    .replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|'[^'\n]*'|「[^」\n]*」/g, ' ')
    .replace(/\([^)\n]*\)|（[^）\n]*）/g, ' ')
    .replace(/(\d)\.(?=\d)/g, '$1,')
    .replace(/(^|\s)\d{1,2}[.)]\s*/g, '$1');
}

/** Endings of a spoken, non-용 sentence. A short fragment that ends so is not a name or a price. */
const SPOKEN_END = /[다요어니까래네해죠줘돼봐야]$/;
const SUBJECT_END = /[은는을를]$/;

/** A price line ("김치찜 9,000원") or a bare dish list ("국밥 칼국수"): no sentence to judge. */
function isLabelLine(s: string): boolean {
  if (SPOKEN_END.test(s)) return false;
  const tokens = s.split(/\s+/);
  if (/\d/.test(s)) return tokens.length <= 4;
  return tokens.length <= 2 && !tokens.some((t) => SUBJECT_END.test(t));
}

/** True when every Korean sentence ends in the 용 tone (or is a bare 주인님 call or a tiny word). */
function toneOk(text: string): boolean {
  if (!HANGUL.test(text)) return false;
  for (const raw of toneText(text).split(SPLIT)) {
    const s = lastLetters(raw);
    if (!HANGUL.test(s)) continue;
    if (Array.from(s.replace(/\s/g, '')).length <= 2) continue;
    if (s.endsWith('용') || s.endsWith('주인님')) continue;
    if (isLabelLine(s)) continue;
    return false;
  }
  return true;
}

export function checkReplyRules(text: string): RuleFailure | null {
  const t = text.trim();
  if (Array.from(t).length > REPLY_MAX_CHARS) return 'TOO_LONG';
  if (CODE_FENCE.test(t) || CODE_LINE.test(t) || (t.match(CODE_PUNCT_LINE)?.length ?? 0) >= 2) {
    return 'CODE';
  }
  if ((t.match(LIST_LINE)?.length ?? 0) >= 3 || /^\s*\|?\s*-{3,}/m.test(t)) return 'LIST';
  if (t.split('\n').filter((l) => l.trim() !== '').length > 4) return 'LIST';
  if (FORBIDDEN.test(t)) return 'FORBIDDEN_WORD';
  if (WRONG_ADDRESS.test(t)) return 'ADDRESS';
  if (!toneOk(t)) return 'TONE';
  return null;
}
