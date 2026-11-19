'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import { useSubmitLock } from '../../base/useSubmitLock';
import { levelWithRo } from '../LimitBlocked';
import styles from './LimitChangeCard.module.css';

export type LimitField = 'perOrder' | 'monthlyBudget';
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
  readonly levelFrom?: number;
  readonly levelTo?: number;
  /** Raising needs Face ID (or the device lock) first; lowering does not. */
  readonly needsReauth: boolean;
  /** Extra lines under the change ("30일 한도", "500,000원 그대로"). */
  readonly rows?: readonly LimitChangeRow[];
  /** Asks the parent to reauth and change. Only the button calls it, never the chat. */
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly status?: LimitChangeStatus;
}

const FIELD_LABEL: Record<LimitField, string> = {
  perOrder: '한 번에 쓸 수 있는 돈',
  monthlyBudget: '이번 달 배달 예산',
};

function FaceIdIcon() {
  return (
    <svg
      className={styles.faceId}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 10v1M15 10v1M12 10v4h-1M9.5 16.5c1.4 1 3.6 1 5 0" />
    </svg>
  );
}

/** Shows a limit change asked for in words, before and after, with a confirm button. */
export function LimitChangeCard({
  field,
  from,
  to,
  levelFrom,
  levelTo,
  needsReauth,
  rows,
  onConfirm,
  onCancel,
  status = 'idle',
}: LimitChangeCardProps) {
  const confirming = status === 'confirming';
  // One press changes once; after a failure it can be pressed again.
  const confirm = useSubmitLock(confirming, onConfirm);

  const showLevel = levelFrom !== undefined && levelTo !== undefined && levelFrom !== levelTo;
  return (
    <section className={styles.card} aria-label="한도 바꾸기">
      <p className={styles.title}>한도 바꾸기</p>
      <div className={styles.change}>
        <span className={styles.field}>{FIELD_LABEL[field]}</span>
        <span className={styles.amounts}>
          <s className={styles.from}>{formatOkrw(from)}</s>
          <svg
            className={styles.arrow}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
          <span className={styles.srOnly}>에서</span>
          <b className={styles.to}>{formatOkrw(to)}</b>
          <span className={styles.srOnly}>으로</span>
        </span>
      </div>
      {showLevel ? (
        <div className={styles.row}>
          <span className={styles.rowLabel}>레벨</span>
          <span>
            {String(levelFrom)}에서 {levelWithRo(levelTo)}
          </span>
        </div>
      ) : null}
      {rows?.map((r, i) => (
        <div key={`${String(i)}-${r.label}`} className={styles.row}>
          <span className={styles.rowLabel}>{r.label}</span>
          <span className={styles.num}>{r.value}</span>
        </div>
      ))}
      {status === 'failed' ? (
        <p className={styles.failed} role="alert">
          못 바꿨어요. 다시 해 볼까요?
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="choice"
          loading={confirming}
          icon={needsReauth ? <FaceIdIcon /> : undefined}
          onPress={confirm}
        >
          {needsReauth ? 'Face ID로 확인하고 바꾸기' : '바꾸기'}
        </Button>
        <Button variant="text" size="md" onPress={onCancel}>
          그만두기
        </Button>
      </div>
    </section>
  );
}
