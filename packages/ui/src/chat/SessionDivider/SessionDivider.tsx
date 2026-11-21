import styles from './SessionDivider.module.css';

export interface SessionDividerProps {
  /** Ready-made text, "11월 21일 저녁". */
  readonly label: string;
}

/** The date line over an earlier conversation (SessionDivider.md). Says when, nothing more. */
export function SessionDivider({ label }: SessionDividerProps) {
  return <p className={styles.divider}>{label}</p>;
}
