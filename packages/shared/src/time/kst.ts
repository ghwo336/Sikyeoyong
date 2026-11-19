import { AppError } from '../errors/index.js';

/** Korea has no daylight saving time, so KST is always UTC+9. */
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
