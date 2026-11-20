/** KST is UTC+9 with no daylight saving (shared time/kst.ts). */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_KEY = /^(mon|tue|wed|thu|fri|sat|sun)(?:-(mon|tue|wed|thu|fri|sat|sun))?$/;
const SPAN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]|24):([0-5]\d)$/;

function dayIndex(day: string): number {
  return DAYS.indexOf(day as (typeof DAYS)[number]);
}

/** Days a key covers: "mon-sun", "mon-fri", "sat", or a wrapping range like "fri-mon". */
function daysOf(key: string): Set<number> | null {
  const m = DAY_KEY.exec(key);
  if (!m?.[1]) return null;
  const from = dayIndex(m[1]);
  const to = m[2] === undefined ? from : dayIndex(m[2]);
  const out = new Set<number>();
  for (let d = from; ; d = (d + 1) % 7) {
    out.add(d);
    if (d === to) break;
  }
  return out;
}

/**
 * Whether opening hours (tech-spec 7.1, `{ "mon-sun": "10:00-22:00" }`, KST)
 * cover a moment. A span ending before it starts runs past midnight into the
 * next day ("15:00-02:00"); "24:00" is the end of the day. A span with the
 * same start and end, or any key or span that does not parse, counts as
 * closed: a merchant is never shown as open on a guess.
 */
export function isOpenAt(hours: Readonly<Record<string, string>>, unixMs: number): boolean {
  const kst = new Date(unixMs + KST_OFFSET_MS);
  const today = (kst.getUTCDay() + 6) % 7; // Monday 0
  const yesterday = (today + 6) % 7;
  const minute = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  for (const [key, span] of Object.entries(hours)) {
    const days = daysOf(key);
    const m = SPAN.exec(span);
    if (days === null || m === null) continue;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    if (end > 24 * 60 || start === end) continue;
    if (start < end) {
      if (days.has(today) && minute >= start && minute < end) return true;
    } else {
      if (days.has(today) && minute >= start) return true;
      if (days.has(yesterday) && minute < end) return true;
    }
  }
  return false;
}
