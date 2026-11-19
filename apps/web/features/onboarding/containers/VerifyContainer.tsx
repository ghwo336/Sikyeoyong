'use client';

import { KakaoVerify, ScreenTitle, StepProgress, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { SIGNUP_STEPS } from '../steps';
import { useSignupConfig, useVerifyIdentity } from '../hooks/useSignup';

/** Verify.dc.html: step 1 of 3, the title, one identity button. No dragon hatches without it (D-16). */
export function VerifyContainer() {
  const router = useRouter();
  const config = useSignupConfig().data;
  const verify = useVerifyIdentity();
  return (
    <>
      <TopBar
        onBack={() => {
          router.back();
        }}
        trailing={<StepProgress steps={SIGNUP_STEPS} current={1} />}
      />
      <ScreenTitle
        variant="title"
        title={'주인님이 누군지\n한 번만 확인할게요'}
        description="실명 확인된 주인만 비서를 둘 수 있어요."
      />
      {config ? (
        <KakaoVerify
          mode={config.verifyMode}
          status={verify.isPending ? 'pending' : verify.isError ? 'failed' : 'idle'}
          onVerify={() => {
            verify.mutate(undefined, {
              onSuccess: (r) => {
                if (r.verified) router.push('/name');
              },
            });
          }}
        />
      ) : null}
    </>
  );
}
