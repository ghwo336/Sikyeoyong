import { Button } from '../../base/Button';
import { KakaoMark } from '../SocialLogin';
import styles from './KakaoVerify.module.css';

export type VerifyMode = 'kakao' | 'mock';
export type VerifyStatus = 'idle' | 'pending' | 'failed';

export interface KakaoVerifyProps {
  /** Verifying is the parent's job; this only starts it. */
  readonly onVerify: () => void;
  /** kakao: real KakaoTalk identity check. mock: trial check (config, decisions D-16). */
  readonly mode: VerifyMode;
  readonly status: VerifyStatus;
}

const TEXT: Record<VerifyMode, { button: string; note: string }> = {
  kakao: { button: '카카오톡으로 본인 인증', note: '구글로 가입했어도 카카오톡으로 인증해요' },
  mock: { button: '체험용으로 인증하기', note: '체험판이라 실제 본인 인증 없이 넘어가요' },
};

/** Draws the identity check button and its one line (KakaoVerify.md). */
export function KakaoVerify({ onVerify, mode, status }: KakaoVerifyProps) {
  const text = TEXT[mode];
  const pending = status === 'pending';
  return (
    <div className={styles.verify}>
      {status === 'failed' ? (
        <p className={styles.failed} role="alert">
          인증이 안 됐어요. 다시 해 주세요.
        </p>
      ) : null}
      {/* Kakao's color and mark only for a real Kakao check (brand guide); trial uses the plain button. */}
      <Button
        variant={mode === 'kakao' ? 'kakao' : 'primary'}
        icon={mode === 'kakao' ? <KakaoMark /> : undefined}
        loading={pending}
        onPress={() => {
          if (!pending) onVerify();
        }}
      >
        {text.button}
      </Button>
      <p className={styles.note}>{text.note}</p>
    </div>
  );
}
