import styles from './ErrorLine.module.css';

export type ErrorLineAlign = 'start' | 'center';

export interface ErrorLineProps {
  /** One short line in the dragon's plain words ("못 바꿨어요. 다시 해 볼까요?"). */
  readonly children: string;
  /** So an input can point at it with aria-describedby (TextField). */
  readonly id?: string;
  /** center under a centered button (KakaoVerify). Default start. */
  readonly align?: ErrorLineAlign;
}

/** Draws one amber line that screen readers announce when it appears (ErrorLine.md). */
export function ErrorLine({ children, id, align = 'start' }: ErrorLineProps) {
  return (
    <p id={id} className={styles.line} data-align={align} role="alert">
      {children}
    </p>
  );
}
