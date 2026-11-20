import { Button } from '../../base/Button';
import { TermsLine } from '../TermsLine';
import styles from './EmailStart.module.css';

export interface EmailStartProps {
  /** The login itself (the vault, the session) is the parent's job; this only starts it. */
  readonly onStart: () => void;
  /** A sign-in is under way: the button shows it and does not start another. */
  readonly loading?: boolean;
  readonly termsHref: string;
  readonly privacyHref: string;
}

/**
 * The one start button (D-29: one login, by email) and the terms line. No brand name on
 * the screen (D-17). When Kakao comes to the login, only this first button changes.
 */
export function EmailStart({ onStart, loading = false, termsHref, privacyHref }: EmailStartProps) {
  return (
    <div className={styles.start}>
      <Button
        variant="primary"
        loading={loading}
        onPress={() => {
          if (!loading) onStart();
        }}
      >
        이메일로 시작하기
      </Button>
      <TermsLine termsHref={termsHref} privacyHref={privacyHref} />
    </div>
  );
}
