import styles from './OrderStatusHeader.module.css';

export type OrderStatusVariant = 'eta-first' | 'remaining-first';

export interface OrderStatusHeaderProps {
  /** Arrival time, unix ms. Shown as KST "N시 M분". */
  readonly etaAt: number;
  /** Whole minutes left, from the server. */
  readonly remainingMin: number;
  /** eta-first: Done (cooking). remaining-first: Tracking (on the way). */
  readonly variant: OrderStatusVariant;
  /** Tracking only: distance already formatted by the parent ("1.2km"). */
  readonly distance?: string;
}

const KST = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/** "12시 55분" in Korea time, whatever the device time zone is. 24-hour clock. */
export function formatKstClock(unixMs: number): string {
  const parts = KST.formatToParts(new Date(unixMs));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return `${String(hour)}시 ${String(minute)}분`;
}

/** "8분 남았어요", or "곧 도착해요" once nothing is left. */
export function formatRemaining(remainingMin: number): string {
  const min = Number.isFinite(remainingMin) ? Math.ceil(remainingMin) : 0;
  return min <= 0 ? '곧 도착해요' : `${String(min)}분 남았어요`;
}

/** Draws the arrival time and the minutes left, one of them large (OrderStatusHeader.md). */
export function OrderStatusHeader({
  etaAt,
  remainingMin,
  variant,
  distance,
}: OrderStatusHeaderProps) {
  const eta = `${formatKstClock(etaAt)} 도착 예정`;
  const remaining = formatRemaining(remainingMin);
  const big = variant === 'eta-first' ? eta : remaining;
  let small = variant === 'eta-first' ? remaining : eta;
  if (variant === 'remaining-first' && distance !== undefined && distance !== '') {
    small = `${small}, ${distance}`;
  }
  return (
    <div className={styles.header}>
      <p className={styles.big}>{big}</p>
      <p className={styles.small}>{small}</p>
    </div>
  );
}
