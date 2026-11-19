import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button';
import { useSubmitLock } from './useSubmitLock';

// Harness states from docs/wiki/components/ui/base/useSubmitLock.md. The hook has no
// look of its own; the demo counts calls so a double tap can be seen to count once.
function SubmitLockDemo({ failAfterMs }: { failAfterMs?: number }) {
  const [busy, setBusy] = useState(false);
  const [calls, setCalls] = useState(0);
  const submit = useSubmitLock(busy, () => {
    setCalls((c) => c + 1);
    if (failAfterMs !== undefined) {
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
      }, failAfterMs);
    }
  });
  return (
    <div style={{ display: 'grid', gap: 12, width: 342 }}>
      <Button variant="primary" loading={busy} onPress={submit}>
        두 번 눌러 보세요
      </Button>
      <span>불린 횟수 {String(calls)}</span>
    </div>
  );
}

const meta = {
  title: 'base/useSubmitLock',
  component: SubmitLockDemo,
} satisfies Meta<typeof SubmitLockDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 부모가 다시 그리지 않음: 몇 번 눌러도 한 번 */
export const NoRerender: Story = {};

/** 부모가 바쁨을 올렸다가 실패로 내림: 다시 누를 수 있음 */
export const RetryAfterFailure: Story = { args: { failAfterMs: 1500 } };
