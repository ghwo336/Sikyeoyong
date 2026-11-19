import { AppError } from '../errors/index.js';

/** Korea has had no daylight saving time since 1988, so KST is UTC+9 for every date this app sees. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Years before 1970 never occur here, and Date.UTC maps 0000-0099 to 19xx. */
const MONTH_KST = /^(19[7-9]\d|[2-9]\d{3})-(0[1-9]|1[0-2])$/;

/** Calendar month in KST for a unix ms time, as 'YYYY-MM' (personal budget month, tech-spec 3.7). */
export function kstMonthOf(unixMs: number): string {
  if (!Number.isSafeInteger(unixMs)) {
    throw new AppError('INTERNAL', { reason: 'unix ms must be a safe integer' });
  }
  const d = new Date(unixMs + KST_OFFSET_MS);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('INTERNAL', { reason: 'unix ms out of Date range' });
  }
  return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** [startMs, endMs) of a KST calendar month in unix ms. */
export function kstMonthRange(monthKst: string): {
  readonly startMs: number;
  readonly endMs: number;
} {
  const m = MONTH_KST.exec(monthKst);
  if (!m) throw new AppError('INTERNAL', { reason: 'monthKst must be YYYY-MM' });
  const year = Number(m[1]);
  const month = Number(m[2]);
  return {
    startMs: Date.UTC(year, month - 1, 1) - KST_OFFSET_MS,
    endMs: Date.UTC(year, month, 1) - KST_OFFSET_MS,
  };
}

interface KstParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/** Wall clock parts in Seoul for a unix ms time. Does not depend on the device time zone. */
function kstParts(unixMs: number): KstParts {
  if (!Number.isFinite(unixMs)) {
    throw new AppError('INTERNAL', { reason: 'unix ms must be finite' });
  }
  const d = new Date(unixMs + KST_OFFSET_MS);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('INTERNAL', { reason: 'unix ms out of Date range' });
  }
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** "12시 55분", "0시 5분": KST, 24-hour clock (Done, Tracking arrival time). */
export function formatKstClock(unixMs: number): string {
  const p = kstParts(unixMs);
  return `${String(p.hour)}시 ${String(p.minute)}분`;
}

/** "2026. 12. 1.": a KST date the way ko-KR writes it (IdCard birth day). */
export function formatKstDate(unixMs: number): string {
  const p = kstParts(unixMs);
  return `${String(p.year)}. ${String(p.month)}. ${String(p.day)}.`;
}

/** "12월 3일 오후 2시", "12월 3일 오전 9시 30분": KST, 12-hour clock (Cap refill time). */
export function formatKstDateTime(unixMs: number): string {
  const p = kstParts(unixMs);
  const half = p.hour < 12 ? '오전' : '오후';
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const minute = p.minute === 0 ? '' : ` ${String(p.minute)}분`;
  return `${String(p.month)}월 ${String(p.day)}일 ${half} ${String(h12)}시${minute}`;
}

/** Calendar days between two moments, counted on KST dates (not 24-hour blocks). */
export function kstDaysBetween(fromMs: number, toMs: number): number {
  const a = kstParts(fromMs);
  const b = kstParts(toMs);
  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((dayB - dayA) / 86_400_000);
}
