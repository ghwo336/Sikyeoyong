import styles from './UserBubble.module.css';

export type UserBubbleStatus = 'sending' | 'sent' | 'failed';

export interface UserBubbleProps {
  /** What the user said, as typed. */
  readonly text: string;
  /** Default sent. Sending is shown faint, failed adds a retry under the bubble. */
  readonly status?: UserBubbleStatus;
  /** Sending again is the parent's job; the button shows only when failed. */
  readonly onRetry?: () => void;
}

/** Draws what the user said as a right-side bubble (UserBubble.md). */
export function UserBubble({ text, status = 'sent', onRetry }: UserBubbleProps) {
  return (
    <div className={styles.wrap} data-status={status} aria-busy={status === 'sending' || undefined}>
      <p className={styles.bubble}>{text}</p>
      {status === 'failed' ? (
        <div className={styles.failed}>
          <span>못 보냈어요</span>
          {onRetry ? (
            <button type="button" className={styles.retry} onClick={onRetry}>
              다시 보내기
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
