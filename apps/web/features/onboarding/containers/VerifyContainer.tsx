'use client';

import { KakaoVerify, StepProgress } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { SIGNUP_STEPS } from '../steps';
import { useSignupConfig, useVerifyIdentity } from '../hooks/useSignup';

/** Verify.dc.html: step 1 of 3, one identity button. No dragon is hatched without it (D-16). */
export function VerifyContainer() {
  const router = useRouter();
  const config = useSignupConfig().data;
  const verify = useVerifyIdentity();
  return (
    <>
      <StepProgress steps={SIGNUP_STEPS} current={1} />
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
