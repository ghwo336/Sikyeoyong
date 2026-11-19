import { Button } from '../../base/Button';
import styles from './HatchProgress.module.css';

export type HatchStepStatus = 'done' | 'doing' | 'waiting' | 'failed';

export interface HatchStep {
  /** "용이 용돈 주머니 만들기", "용이 신분증 만들기", "한 번에 쓸 수 있는 돈 새기기". */
  readonly label: string;
  readonly status: HatchStepStatus;
}

export interface HatchProgressProps {
  readonly steps: readonly HatchStep[];
  /** "다시 깨우기". Shown only on a failed step. Polling is the parent's hook. */
  readonly onRetry?: () => void;
}

const STATUS_TEXT: Record<Exclude<HatchStepStatus, 'failed'>, string> = {
  done: '완료',
  doing: '하는 중',
  waiting: '대기',
};

function StatusIcon({ status }: { status: HatchStepStatus }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" data-status={status}>
      {status === 'done' ? (
        <>
          <circle className={styles.doneDot} cx="12" cy="12" r="11" />
          <path className={styles.check} d="M7.5 12.5l3 3 6-6.5" />
        </>
      ) : null}
      {status === 'doing' ? (
        <>
          <circle className={styles.track} cx="12" cy="12" r="9.5" />
          <path className={styles.arc} d="M12 2.5 A9.5 9.5 0 0 1 21.5 12" />
        </>
      ) : null}
      {status === 'waiting' ? <circle className={styles.waitRing} cx="12" cy="12" r="9.5" /> : null}
      {status === 'failed' ? (
        <>
          <circle className={styles.failRing} cx="12" cy="12" r="9.5" />
          <path className={styles.failMark} d="M12 7v6M12 16.5v.5" />
        </>
      ) : null}
    </svg>
  );
}

/** Draws the three hatching steps and how far each has come (HatchProgress.md). */
export function HatchProgress({ steps, onRetry }: HatchProgressProps) {
  return (
    <ol className={styles.list} aria-label="알 깨우기 단계">
      {steps.map((step, i) => (
        // Steps have a fixed order and no id.
        <li key={i} className={styles.step} data-status={step.status}>
          <StatusIcon status={step.status} />
          <span className={styles.label}>{step.label}</span>
          {step.status === 'failed' ? (
            onRetry ? (
              <>
                {/* The icon is hidden from screen readers, so say it failed in words. */}
                <span className={styles.srOnly}>안 됐어요</span>
                <Button variant="link" size="sm" onPress={onRetry}>
                  다시 깨우기
                </Button>
              </>
            ) : (
              <span className={styles.state}>안 됐어요</span>
            )
          ) : (
            <span className={styles.state}>{STATUS_TEXT[step.status]}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
