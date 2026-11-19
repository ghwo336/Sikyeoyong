import { formatOkrw } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import styles from './CapReached.module.css';

export interface CapReachedProps {
  /** When the 30-day limit fills again, unix SECONDS (chain resetAt, via the server). */
  readonly resetAt: number;
  /** aokrw that comes back. */
  readonly cap: bigint;
  readonly onNotify: () => void;
  readonly onDismiss: () => void;
  /** Now in unix ms, from the parent (render stays pure; tests pass a fixed time). */
  readonly now: number;
}

const KST_PARTS = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

interface KstParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function kstParts(unixMs: number): KstParts {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(KST_PARTS.formatToParts(new Date(unixMs)).find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** "12월 3일 오후 2시", "12월 3일 오전 9시 30분" in Korea time (Cap.dc.html). */
export function formatKstDateTime(unixMs: number): string {
  const p = kstParts(unixMs);
  const half = p.hour < 12 ? '오전' : '오후';
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const minute = p.minute === 0 ? '' : ` ${String(p.minute)}분`;
  return `${String(p.month)}월 ${String(p.day)}일 ${half} ${String(h12)}시${minute}`;
}

/** Calendar days between two moments, counted on Korean dates (not 24-hour blocks). */
export function kstDaysBetween(fromMs: number, toMs: number): number {
  const a = kstParts(fromMs);
  const b = kstParts(toMs);
  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((dayB - dayA) / 86_400_000);
}

function whenText(days: number): string {
  if (days <= 0) return '오늘';
  if (days === 1) return '내일';
  return `${String(days)}일 뒤에`;
}

/** Shows, large, the day the 30-day limit fills again (CapReached.md). */
export function CapReached({ resetAt, cap, onNotify, onDismiss, now }: CapReachedProps) {
  // The chain gives seconds. Round up to the minute: showing 2:05 for 2:05:30 would
  // invite an order that the chain still rejects.
  const resetMs = Math.ceil((resetAt * 1000) / 60_000) * 60_000;
  const days = kstDaysBetween(now, resetMs);
  return (
    <div className={styles.cap}>
      <div className={styles.when}>
        <p className={styles.date}>{formatKstDateTime(resetMs)}</p>
        <p className={styles.note}>
          {whenText(days)} {formatOkrw(cap)}이 다시 채워져요
        </p>
      </div>
      <div className={styles.actions}>
        <Button variant="primary" onPress={onNotify}>
          다시 채워지면 알려 줘
        </Button>
        <Button variant="text" onPress={onDismiss}>
          괜찮아, 며칠은 집밥 먹을게
        </Button>
      </div>
    </div>
  );
}
