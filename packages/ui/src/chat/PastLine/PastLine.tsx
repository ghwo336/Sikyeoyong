import styles from './PastLine.module.css';

export interface PastLineProps {
  /** Ready-made one line, "돼지국밥 9,000원, 도착함". */
  readonly text: string;
}

/**
 * A card from an earlier conversation folded into one line (PastLine.md, D-34). Text only:
 * it has no button, so an old recommendation or quote can never be pressed again.
 */
export function PastLine({ text }: PastLineProps) {
  return <p className={styles.line}>{text}</p>;
}
