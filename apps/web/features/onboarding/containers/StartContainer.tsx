'use client';

import { EmailStart, Egg, ErrorLine, Hero, ScreenTitle } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useLogin } from '../hooks/useSignup';

/**
 * Start.dc.html: the egg and title in the middle, then one button (D-29: "이메일로 시작하기",
 * the Pouchi login), then the identity check.
 */
export function StartContainer() {
  const router = useRouter();
  const login = useLogin();
  return (
    <>
      {/* No dragon is picked yet: the design draws the forest egg. */}
      <Hero gap="lg" art={<Egg state="closed" species="forest" size={168} />}>
        <ScreenTitle
          variant="display"
          title={'배달은\n용이한테 시켜용'}
          description={'주인님이 정한 한도 안에서만 결제하는\n배달 비서예요. 카드 번호는 몰라요.'}
        />
      </Hero>
      {/* A cancelled or refused start must say so; a button that does nothing looks broken. */}
      {login.isError ? (
        <ErrorLine align="center">시작하지 못했어요. 다시 눌러 주세요.</ErrorLine>
      ) : null}
      <EmailStart
        onStart={() => {
          login.mutate(undefined, {
            // The vault is the same for sign-up and sign-in: the front door (EntryGate) decides
            // whether this owner still needs the identity check or already has a dragon.
            onSuccess: () => {
              router.push('/');
            },
          });
        }}
        loading={login.isPending}
        termsHref="/terms"
        privacyHref="/privacy"
      />
    </>
  );
}
