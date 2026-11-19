import styles from './Skeleton.module.css';

/** The text the bar stands in for: wallet amount 28, caption 13, meta 12 (tokens.json type). */
export type SkeletonHeight = 'walletAmount' | 'caption' | 'meta';

export interface SkeletonProps {
  readonly height: SkeletonHeight;
  /** CSS length, about as long as the text it stands for ("10em", "40%"). */
  readonly width: string;
  /** Marks for the caller's tests and CSS (data-part="skeleton"). */
  readonly [data: `data-${string}`]: string | boolean | undefined;
}

/** Draws one still grey bar in place of text that is loading. No shimmer (Skeleton.md). */
export function Skeleton({ height, width, ...data }: SkeletonProps) {
  return (
    <span
      className={`${styles.bar} ${styles[height]}`}
      style={{ width }}
      aria-hidden="true"
      {...data}
    />
  );
}
