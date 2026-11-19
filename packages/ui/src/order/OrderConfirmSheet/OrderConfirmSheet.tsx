'use client';

import { type DragonSpecies, formatOkrw } from '@sikyeoyong/shared';
import { useId } from 'react';
import { Button } from '../../base/Button';
import { Meter, type MeterTone } from '../../base/Meter';
import { Sheet } from '../../base/Sheet';
import { useSubmitLock } from '../../base/useSubmitLock';
import { DragonLine } from '../../dragon/DragonLine';
import type { OrderLine } from '../OrderSummary';
import styles from './OrderConfirmSheet.module.css';

export interface LimitUse {
  /** aokrw used, counting this order. */
  readonly used: bigint;
  /** aokrw limit. */
  readonly max: bigint;
  /** Chosen by the parent; the sheet does not judge limits. Default normal. */
  readonly tone?: MeterTone;
}

export interface OrderConfirmSheetProps {
  readonly open: boolean;
  /** What the dragon says on top ("돼지국밥 시킬게용.\n이대로 괜찮아용?"). */
  readonly line: string;
  readonly species: DragonSpecies;
  /** "마루국밥 본점에서 회사(역삼동)로, 25분쯤", made by the parent. */
  readonly route: string;
  readonly items: readonly OrderLine[];
  /** Without the "요청:" prefix. */
  readonly request?: string;
  /** aokrw to pay, from the server quote. Shown as is. */
  readonly total: bigint;
  /** The per-order limit ("한 번에"). */
  readonly perOrder: LimitUse;
  /** The 30-day limit after this order ("30일 동안 (주문 후)"). */
  readonly period: LimitUse;
  /** Asks the parent to pay. Called once per press; the parent sets confirming while it pays. */
  readonly onConfirm: () => void;
  /** "다시 고를래", Esc, a press outside or a drag down. */
  readonly onCancel: () => void;
  /** While paying: the button spins and does not call onConfirm again. */
  readonly confirming?: boolean;
  /** aokrw the user saw before the server changed the price (SERVER_PRICE_CHANGED, D-19). */
  readonly priceChangedFrom?: bigint;
}

/** Draws the order, the amount to pay, two limit bars and the order button in a sheet. */
export function OrderConfirmSheet({
  open,
  line,
  species,
  route,
  items,
  request,
  total,
  perOrder,
  period,
  onConfirm,
  onCancel,
  confirming = false,
  priceChangedFrom,
}: OrderConfirmSheetProps) {
  // One press pays once; a failed payment can be pressed again with the same order (D-19).
  const confirm = useSubmitLock(confirming, onConfirm);

  const limitsId = useId();
  const amount = formatOkrw(total);
  return (
    // Focus starts on the sheet, never on the pay button: an Enter left over from the
    // chat must not pay before the user has read the order (CLAUDE.md rule 3).
    <Sheet open={open} onClose={onCancel} label="주문 확인" initialFocus="panel">
      <DragonLine text={line} layout="sheet" species={species} />

      <section className={styles.order} aria-label="주문 내용">
        <p className={styles.route}>{route}</p>
        <ul className={styles.lines}>
          {items.map((l, i) => (
            // Lines have no id and the order never changes.
            <li key={i} className={styles.line}>
              <span>
                {l.name} {String(l.quantity)}개
              </span>
              <span className={styles.num}>{formatOkrw(l.price)}</span>
            </li>
          ))}
        </ul>
        {request !== undefined && request !== '' ? (
          <p className={styles.request}>요청: {request}</p>
        ) : null}
        <div className={styles.divider} aria-hidden="true" />
        <div className={styles.total}>
          <span className={styles.totalLabel}>결제할 금액</span>
          <span className={`${styles.totalAmount} ${styles.num}`}>{amount}</span>
        </div>
      </section>

      <section className={styles.limits} aria-labelledby={limitsId}>
        <h2 id={limitsId} className={styles.limitsTitle}>
          용이가 쓸 수 있는 돈
        </h2>
        <Meter
          label="한 번에"
          value={perOrder.used}
          max={perOrder.max}
          tone={perOrder.tone ?? 'normal'}
          kind="limit"
        />
        <Meter
          label="30일 동안 (주문 후)"
          value={period.used}
          max={period.max}
          tone={period.tone ?? 'normal'}
          kind="limit"
        />
      </section>

      {priceChangedFrom !== undefined ? (
        <p className={styles.changed} role="alert">
          가격이 {formatOkrw(priceChangedFrom)}에서 {amount}으로 바뀌었어요. 다시 확인해 주세요.
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button variant="primary" loading={confirming} onPress={confirm}>
          <span className={styles.num}>{amount}</span> 시키기
        </Button>
        <Button variant="text" onPress={onCancel}>
          다시 고를래
        </Button>
      </div>
    </Sheet>
  );
}
