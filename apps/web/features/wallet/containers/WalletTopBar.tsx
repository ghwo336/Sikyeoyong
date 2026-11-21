'use client';

import { TopBar } from '@sikyeoyong/ui';
import { useTransitionRouter } from '../../../lib/transition-router';

/** Wallet.dc.html title row: 용이 용돈, back to the chat. */
export function WalletTopBar() {
  const router = useTransitionRouter();
  return (
    <TopBar
      title="용이 용돈"
      backLabel="대화로 돌아가기"
      onBack={() => {
        router.push('/');
      }}
    />
  );
}
