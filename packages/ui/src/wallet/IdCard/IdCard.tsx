import { type DragonSpecies, formatOkrw } from '@sikyeoyong/shared';
import { Dragon } from '../../dragon/Dragon';
import styles from './IdCard.module.css';

export interface IdCardProps {
  /** The dragon's name ("용이"). */
  readonly name: string;
  /** "이호재" in "이호재님의 배달 비서". */
  readonly ownerName: string;
  readonly level: number;
  /** aokrw per-order limit. */
  readonly perOrder: bigint;
  readonly ownerVerified: boolean;
  /** Birth time, unix ms. Shown as a Korean date "2026. 12. 1.". */
  readonly bornAt: number;
  /** The card takes the species color (D-20). */
  readonly species: DragonSpecies;
}

const KST_DATE = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/** "2026. 12. 1." in Korea time (IdCard.dc.html). */
export function formatKstDate(unixMs: number): string {
  const parts = KST_DATE.formatToParts(new Date(unixMs));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}. ${get('month')}. ${get('day')}.`;
}

/** Wings grow at level 3 (Dragon.md). */
const WINGS_LEVEL = 3;

/** Draws the dragon's ID card: name, owner, level, per-order limit, verified, born (IdCard.md). */
export function IdCard({
  name,
  ownerName,
  level,
  perOrder,
  ownerVerified,
  bornAt,
  species,
}: IdCardProps) {
  return (
    <section className={styles.card} data-species={species} aria-label={`${name} 신분증`}>
      <div className={styles.head}>
        <div className={styles.portrait}>
          <Dragon mood="default" size={64} species={species} wings={level >= WINGS_LEVEL} />
        </div>
        <div className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.owner}>{ownerName}님의 배달 비서</span>
        </div>
      </div>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>레벨</dt>
          <dd>{String(level)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>한 번에</dt>
          <dd className={styles.num}>{formatOkrw(perOrder)}까지</dd>
        </div>
        <div className={styles.fact}>
          <dt>주인</dt>
          <dd>{ownerVerified ? '실명 확인됨' : '실명 확인 전'}</dd>
        </div>
        <div className={styles.fact}>
          <dt>태어난 날</dt>
          <dd className={styles.num}>{formatKstDate(bornAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
