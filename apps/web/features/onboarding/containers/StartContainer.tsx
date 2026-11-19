'use client';

import { SocialLogin } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useLogin } from '../hooks/useSignup';

/** Start.dc.html: Kakao or Google, then the identity check. */
export function StartContainer() {
  const router = useRouter();
  const login = useLogin();
  const start = (provider: 'kakao' | 'google') => {
    login.mutate(provider, {
      onSuccess: () => {
        router.push('/verify');
      },
    });
  };
  return (
    <SocialLogin
      onKakao={() => {
        start('kakao');
      }}
      onGoogle={() => {
        start('google');
      }}
      loading={login.isPending ? login.variables : undefined}
      termsHref="/terms"
      privacyHref="/privacy"
    />
  );
}
