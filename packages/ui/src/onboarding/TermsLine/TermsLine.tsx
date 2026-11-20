import styles from './TermsLine.module.css';

export interface TermsLineProps {
  readonly termsHref: string;
  readonly privacyHref: string;
}

/** The one terms line under the start buttons (Start.dc.html), shared by every way to start. */
export function TermsLine({ termsHref, privacyHref }: TermsLineProps) {
  return (
    <p className={styles.terms}>
      시작하면{' '}
      <a href={termsHref} className={styles.link}>
        이용약관
      </a>
      과{' '}
      <a href={privacyHref} className={styles.link}>
        개인정보 처리방침
      </a>
      에 동의하게 돼요
    </p>
  );
}
