import styles from './StepProgress.module.css';

export type StepProgressSize = 'sm' | 'md';

export interface StepProgressProps {
  /** Step names in order ("주문 접수", "조리 중", ...). Sign-up passes plain names and hides them. */
  readonly steps: readonly string[];
  /** 1-based current step. Out of range or not an integer is clamped (StepProgress.md). */
  readonly current: number;
  /** Show the names under the bar, current one bold (Done, Tracking). */
  readonly showLabels?: boolean;
  /** sm: 4px bar (Verify, Name, Budget). md: 6px bar (Done, Tracking, Arrived). Default sm. */
  readonly size?: StepProgressSize;
}

/** Clamps current into 1..total; NaN and fractions fall back safely. */
export function clampStep(current: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(current)) return current === Infinity ? total : 1;
  return Math.min(total, Math.max(1, Math.floor(current)));
}

/** Draws which step of how many as filled cells (StepProgress.md). */
export function StepProgress({
  steps,
  current,
  showLabels = false,
  size = 'sm',
}: StepProgressProps) {
  const total = steps.length;
  if (total === 0) return null;
  const at = clampStep(current, total);
  const name = steps[at - 1];
  const label = `${String(total)}단계 중 ${String(at)}단계`;
  const columns = { gridTemplateColumns: `repeat(${String(total)}, minmax(0, 1fr))` };
  return (
    <div className={`${styles.progress} ${styles[size]}`}>
      <div
        role="progressbar"
        aria-label={showLabels && name !== undefined ? `${label}, ${name}` : label}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={at}
        className={styles.cells}
        style={columns}
      >
        {steps.map((_, i) => (
          // Names can repeat and the order never changes, so the index is the key.
          <div key={i} className={styles.cell} data-done={i < at || undefined} />
        ))}
      </div>
      {showLabels ? (
        <div className={styles.labels} style={columns} aria-hidden="true">
          {steps.map((step, i) => (
            <span key={i} data-current={i === at - 1 || undefined}>
              {step}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
