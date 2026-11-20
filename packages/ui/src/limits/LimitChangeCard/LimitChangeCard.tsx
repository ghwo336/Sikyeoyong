'use client';

import type { LimitField } from '@sikyeoyong/shared';
import { AmountChange } from '../../base/AmountChange';
import { Button } from '../../base/Button';
import { DetailRows } from '../../base/DetailRows';
import { useSubmitLock } from '../../base/useSubmitLock';
import styles from './LimitChangeCard.module.css';
import { Icon } from '../../base/Icon';
import { ActionPair } from '../../base/ActionPair';
import { ErrorLine } from '../../base/ErrorLine';

// The field list is shared with the chat card the server sends (LimitChangeCardView, D-31).
export type { LimitField };
export type LimitChangeStatus = 'idle' | 'confirming' | 'failed';

export interface LimitChangeRow {
  readonly label: string;
  /** Already formatted by the parent ("500,000원 그대로"). */
  readonly value: string;
}

export interface LimitChangeCardProps {
  readonly field: LimitField;
  /** aokrw before and after. */
  readonly from: bigint;
  readonly to: bigint;
  /** Raising needs Face ID (or the device lock) first; lowering does not. */
  readonly needsReauth: boolean;
  /** Extra lines under the change ("30일에 쓸 돈", "300,000원 그대로"). */
  readonly rows?: readonly LimitChangeRow[];
  /** Asks the parent to reauth and change. Only the button calls it, never the chat. */
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly status?: LimitChangeStatus;
}

const FIELD_LABEL: Record<LimitField, string> = {
  perOrder: '한 번에 쓸 돈',
  myPeriodic: '30일에 쓸 돈',
};

/** Shows a limit change asked for in words, before and after, with a confirm button. */
export function LimitChangeCard({
  field,
  from,
  to,
  needsReauth,
  rows,
  onConfirm,
  onCancel,
  status = 'idle',
}: LimitChangeCardProps) {
  const confirming = status === 'confirming';
  // One press changes once; after a failure it can be pressed again.
  const confirm = useSubmitLock(confirming, onConfirm);

  const detailRows = rows ?? [];
  return (
    <section className={styles.card} aria-label="한도 바꾸기">
      <p className={styles.title}>한도 바꾸기</p>
      <div className={styles.change}>
        <span className={styles.field}>{FIELD_LABEL[field]}</span>
        <AmountChange from={from} to={to} />
      </div>
      {detailRows.length > 0 ? <DetailRows rows={detailRows} size="small" gap="loose" /> : null}
      {status === 'failed' ? <ErrorLine>못 바꿨어요. 다시 해 볼까요?</ErrorLine> : null}
      <ActionPair
        gap="sm"
        primary={
          <Button
            variant="primary"
            size="choice"
            loading={confirming}
            icon={needsReauth ? <Icon name="face-id" className={styles.faceId} /> : undefined}
            onPress={confirm}
          >
            {needsReauth ? 'Face ID로 확인하고 바꾸기' : '바꾸기'}
          </Button>
        }
        secondary={
          <Button variant="text" size="md" onPress={onCancel}>
            그만두기
          </Button>
        }
      />
    </section>
  );
}
