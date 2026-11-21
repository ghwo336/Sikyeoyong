'use client';

import { Button, ErrorLine, TopBar } from '@sikyeoyong/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { resumeSession } from '../../../lib/session/entry';

/**
 * /pouchi/callback: the vault came back in the same tab (Safari passkey). Finish that same
 * request once, then go through the front door (EntryGate decides the next screen). A failure
 * offers the start again; it never counts as a login.
 */
export function PouchiCallbackContainer() {
  const router = useRouter();
  const qc = useQueryClient();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    resumeSession()
      .then(() => {
        qc.removeQueries({ queryKey: ['me'] });
        router.replace('/');
      })
      .catch(() => {
        setFailed(true);
      });
  }, [qc, router]);
  if (!failed) return null;
  return (
    <>
      <TopBar hiddenTitle="로그인" />
      <ErrorLine align="center">로그인을 마치지 못했어요. 처음부터 다시 해 주세요.</ErrorLine>
      <Button
        variant="primary"
        onPress={() => {
          router.replace('/start');
        }}
      >
        처음으로
      </Button>
    </>
  );
}
