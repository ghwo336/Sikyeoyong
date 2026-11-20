import { formatOkrw } from '@sikyeoyong/shared';

// Display strings the ui components take ready-made ("25분", "오늘 오후 12:28").
// Times are shown in KST whatever the device time zone is.

const KST = 'Asia/Seoul';

/** "25분" for RecommendationList eta. */
export function minutes(min: number): string {
  return `${String(min)}분`;
}

/** "마루국밥 본점에서 회사(역삼동)로", "한상보쌈에서 집으로", plus ", 25분쯤" on the confirm sheet. */
export function routeLine(store: string, destination: string, etaMin?: number): string {
  const base = `${store}에서 ${withRo(destination)}`;
  return etaMin === undefined ? base : `${base}, ${String(etaMin)}분쯤`;
}

const KST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: KST, dateStyle: 'short' });
const KST_TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "오늘 오후 12:28" for the chat stamp. Another day shows the time only. */
export function chatStamp(unixMs: number, now: number): string {
  const time = KST_TIME.format(unixMs);
  return KST_DAY.format(unixMs) === KST_DAY.format(now) ? `오늘 ${time}` : time;
}

/**
 * "9,000 / 10,000원" for Receipt's small rows (OrderSummary details take text). The unit shows
 * once, after the max, the same rule as ui Amount `unit={false}` with AmountRatio.
 */
export function amountRatioText(value: bigint, max: bigint): string {
  return `${formatOkrw(value).replace(/원$/, '')} / ${formatOkrw(max)}`;
}

/**
 * The topic particle after a word: 은 after a final consonant, 는 otherwise ("보쌈 정식은",
 * "돼지국밥은", "김밥은", "라면은", "피자는"). A word not ending in Hangul takes 는.
 */
export function withEunNeun(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  const hangul = last >= 0xac00 && last <= 0xd7a3;
  return `${word}${hangul && (last - 0xac00) % 28 !== 0 ? '은' : '는'}`;
}

/**
 * The direction particle after a place: 으로 after a final consonant except ㄹ, 로 otherwise
 * ("집으로", "회사로", "서울로"). A note in parentheses at the end does not count, the word
 * before it does ("회사(역삼동)로"). A word not ending in Hangul takes 로.
 */
export function withRo(word: string): string {
  const base = word.replace(/(\s*\([^()]*\))+$/, '');
  const code = base.charCodeAt(base.length - 1) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return `${word}로`;
  const final = code % 28;
  return `${word}${final === 0 || final === 8 ? '로' : '으로'}`;
}
