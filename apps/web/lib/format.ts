// Display strings the ui components take ready-made ("25분", "오늘 오후 12:28").
// Times are shown in KST whatever the device time zone is.

const KST = 'Asia/Seoul';

/** "25분" for RecommendationList eta. */
export function minutes(min: number): string {
  return `${String(min)}분`;
}

/** "마루국밥 본점에서 회사(역삼동)로", plus ", 25분쯤" on the confirm sheet. */
export function routeLine(store: string, destination: string, etaMin?: number): string {
  const base = `${store}에서 ${destination}로`;
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
