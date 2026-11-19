import { formatKstDateTime, formatOkrw, kstDaysBetween } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import styles from './CapReached.module.css';
import { ActionPair } from '../../base/ActionPair';

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

// The KST helpers are shared (packages/shared time/kst); re-exported for older imports.
export { formatKstDateTime, kstDaysBetween };

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
      <ActionPair
        gap="md"
        primary={
          <Button variant="primary" onPress={onNotify}>
            다시 채워지면 알려 줘
          </Button>
        }
        secondary={
          <Button variant="text" onPress={onDismiss}>
            괜찮아, 며칠은 집밥 먹을게
          </Button>
        }
      />
    </div>
  );
}
