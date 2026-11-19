import { Button } from '../../base/Button';
import styles from './SocialLogin.module.css';

export type SocialProvider = 'kakao' | 'google';

export interface SocialLoginProps {
  /** OAuth is the parent's job; these only start it. */
  readonly onKakao: () => void;
  readonly onGoogle: () => void;
  /** Which sign-in is under way. While one runs, neither button starts another. */
  readonly loading?: SocialProvider;
  readonly termsHref: string;
  readonly privacyHref: string;
}

/** Kakao's speech-bubble mark, as in Start.dc.html (Kakao login button guide colors). */
function KakaoMark() {
  return (
    <svg className={styles.kakaoMark} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7.3-9-7.3z" />
    </svg>
  );
}

/** Google's four-color G, as in Start.dc.html. */
function GoogleMark() {
  return (
    <svg className={styles.googleMark} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"
        className={styles.gBlue}
      />
      <path
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.1 22 12 22z"
        className={styles.gGreen}
      />
      <path
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z"
        className={styles.gYellow}
      />
      <path
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 3 14.7 2 12 2 8.1 2 4.8 4.2 3.1 7.4L6.4 10C7.2 7.8 9.4 6 12 6z"
        className={styles.gRed}
      />
    </svg>
  );
}

/** Draws the Kakao and Google start buttons and the one terms line (SocialLogin.md). */
export function SocialLogin({
  onKakao,
  onGoogle,
  loading,
  termsHref,
  privacyHref,
}: SocialLoginProps) {
  const busy = loading !== undefined;
  return (
    <div className={styles.login}>
      <Button
        variant="kakao"
        icon={<KakaoMark />}
        loading={loading === 'kakao'}
        onPress={() => {
          if (!busy) onKakao();
        }}
      >
        카카오로 시작하기
      </Button>
      <Button
        variant="secondary"
        icon={<GoogleMark />}
        loading={loading === 'google'}
        onPress={() => {
          if (!busy) onGoogle();
        }}
      >
        구글로 시작하기
      </Button>
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
    </div>
  );
}
