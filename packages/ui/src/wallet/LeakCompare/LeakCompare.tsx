import { formatOkrw } from '@sikyeoyong/shared';
import styles from './LeakCompare.module.css';

/** The dragon's one line (LeakCompare.dc.html). Rule 11: the order path is stopped, the bypass loses the pocket. */
export const LEAK_DRAGON_LINE = '주문으로는 큰돈이 막히고, 다른 길로 새도 주머니만 잃어용.';

/** Inside 자세히 보기 only: the precise wording (CLAUDE.md rule 11, decisions D-02, D-06). */
export const LEAK_DETAIL_LINE =
  // verify-allow: D17 자세히 보기 안에서만 보이는 정확한 문구 (규칙 11)
  '주문 경로의 큰돈은 체인이 막고, 우회 경로로는 float만 잃는다. 한도를 넘는 주문은 실행 중에 revert되어 블록에 남고 가스가 든다.';

export interface LeakCompareProps {
  /** aokrw, the per-order limit. */
  readonly perOrderLimit: bigint;
  /** aokrw, the cap over the whole period. */
  readonly periodicCap: bigint;
  /** Length of that period in seconds (30 days, or 1 hour in the demo profile). */
  readonly periodSec: number;
  /** aokrw, the most the dragon's pocket is kept at (limit x multiplier + gas share). */
  readonly floatAtRisk: bigint;
  /** aokrw, what the pocket holds now. */
  readonly pocket: bigint;
  /** 자세히 보기 on: add a closed 자세히 보기 that holds the exact one-line wording. */
  readonly detailed?: boolean;
}

/** "30일", "1시간", "N초": the period as the screen says it. */
export function periodLabel(sec: number): string {
  if (sec % 86_400 === 0) return `${sec / 86_400}일`;
  if (sec % 3_600 === 0) return `${sec / 3_600}시간`;
  return `${sec}초`;
}

/**
 * Key leak comparison (demo scene 5, LeakCompare.dc.html): a thief with the key against a
 * card number kept with a merchant, then against the dragon. Numbers only, plus the dragon's line.
 */
export function LeakCompare({
  perOrderLimit,
  periodicCap,
  periodSec,
  floatAtRisk,
  pocket,
  detailed = false,
}: LeakCompareProps) {
  return (
    <div className={styles.root}>
      <p className={styles.dragon}>{LEAK_DRAGON_LINE}</p>
      <section className={styles.card} data-part="card-number" aria-label="카드번호를 맡겼다면">
        <span className={styles.label}>카드번호를 맡겼다면</span>
        <span className={`${styles.big} ${styles.over}`}>전부 가져가요</span>
        <span className={styles.sub}>앱 안의 한도는 열쇠가 있으면 건너뛰어요</span>
      </section>
      <section
        className={`${styles.card} ${styles.mine}`}
        data-part="dragon"
        aria-label="시켜용 용이"
      >
        <span className={styles.label}>시켜용 용이</span>
        <div className={styles.block}>
          <span className={styles.sub}>주문으로는 한 번에</span>
          <span className={styles.big}>{formatOkrw(perOrderLimit)}까지만</span>
          <span className={styles.sub}>
            {periodLabel(periodSec)} 동안 다 합쳐서 최대 {formatOkrw(periodicCap)}까지
          </span>
        </div>
        <div className={styles.rule} />
        <div className={styles.block}>
          <span className={styles.sub}>다른 길로 보내도 용이 주머니에는</span>
          <span className={styles.big}>{formatOkrw(floatAtRisk)}만</span>
          <span className={styles.sub}>지금 주머니에 {formatOkrw(pocket)}</span>
        </div>
      </section>
      {detailed && (
        // Closed until pressed: the exact words (chain terms) are for someone who asks (D-17).
        <details className={styles.more} data-part="details">
          <summary className={styles.summary}>자세히 보기</summary>
          <p className={styles.detail}>{LEAK_DETAIL_LINE}</p>
        </details>
      )}
    </div>
  );
}
