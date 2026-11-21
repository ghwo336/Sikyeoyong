'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { ActionPair } from '../../base/ActionPair';
import { Button } from '../../base/Button';
import { DetailRows } from '../../base/DetailRows';
import { ErrorLine } from '../../base/ErrorLine';
import { useSubmitLock } from '../../base/useSubmitLock';
import styles from './OwnerApprovalCard.module.css';

/** The two reasons an order waits for the owner's yes (a per-order raise is LimitBlocked's). */
export type OwnerApprovalReason = 'NEW_MERCHANT' | 'OVER_PERSONAL_BUDGET';
/** idle, one of the two answers being sent, or the last answer did not go through. */
export type OwnerApprovalStatus = 'idle' | 'approving' | 'rejecting' | 'failed';

export interface OwnerApprovalCardProps {
  readonly reason: OwnerApprovalReason;
  /** The store's name as the server sent it. */
  readonly store: string;
  /** aokrw the order would pay. */
  readonly amount: bigint;
  /** Asks the parent to approve. Only the button calls it, never the chat (D-21, rule 3). */
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly status?: OwnerApprovalStatus;
}

const TITLE: Record<OwnerApprovalReason, string> = {
  NEW_MERCHANT: '처음 시키는 가게예요',
  OVER_PERSONAL_BUDGET: '30일에 쓸 돈을 넘어요',
};

/** An order waiting for the owner: what and where, with the yes and the no (OwnerApprovalCard.md). */
export function OwnerApprovalCard({
  reason,
  store,
  amount,
  onApprove,
  onReject,
  status = 'idle',
}: OwnerApprovalCardProps) {
  const busy = status === 'approving' || status === 'rejecting';
  // One press answers once; after a failure the same answer can be pressed again (D-19).
  const approve = useSubmitLock(busy, onApprove);
  const reject = useSubmitLock(busy, onReject);
  return (
    <section className={styles.card} aria-label="주인님 허락" data-theme="fixed">
      <p className={styles.title}>{TITLE[reason]}</p>
      <DetailRows
        rows={[
          { label: '가게', value: store },
          { label: '금액', value: formatOkrw(amount) },
        ]}
        size="small"
        gap="loose"
      />
      {status === 'failed' ? <ErrorLine>답을 못 보냈어요. 다시 해 볼까요?</ErrorLine> : null}
      <ActionPair
        gap="sm"
        primary={
          <Button
            variant="primary"
            size="choice"
            loading={status === 'approving'}
            disabled={status === 'rejecting'}
            onPress={approve}
          >
            허락하기
          </Button>
        }
        secondary={
          <Button
            variant="text"
            size="md"
            loading={status === 'rejecting'}
            disabled={status === 'approving'}
            onPress={reject}
          >
            안 시킬래요
          </Button>
        }
      />
    </section>
  );
}
