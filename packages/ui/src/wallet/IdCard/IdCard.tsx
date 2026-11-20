import { dragonStage, type DragonSpecies, formatKstDate, formatOkrw } from '@sikyeoyong/shared';
import { DetailRows } from '../../base/DetailRows';
import { Dragon } from '../../dragon/Dragon';
import styles from './IdCard.module.css';

export interface IdCardProps {
  /** The dragon's name ("용이"). */
  readonly name: string;
  /** "이호재" in "이호재님의 배달 비서". */
  readonly ownerName: string;
  /** aokrw per-order limit. Also sets how grown the portrait looks (dragonStage, D-31). */
  readonly perOrder: bigint;
  readonly ownerVerified: boolean;
  /** Birth time, unix ms. Shown as a Korean date "2026. 12. 1.". */
  readonly bornAt: number;
  /** The card takes the species color (D-20). */
  readonly species: DragonSpecies;
}

// The date format is shared (packages/shared time/kst); re-exported for older imports.
export { formatKstDate };

/** Draws the dragon's ID card: name, owner, per-order limit, verified, born (IdCard.md). */
export function IdCard({ name, ownerName, perOrder, ownerVerified, bornAt, species }: IdCardProps) {
  return (
    <section className={styles.card} data-species={species} aria-label={`${name} 신분증`}>
      <div className={styles.head}>
        <div className={styles.portrait}>
          <Dragon mood="default" size={64} species={species} wings={dragonStage(perOrder) === 3} />
        </div>
        <div className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.owner}>{ownerName}님의 배달 비서</span>
        </div>
      </div>
      <DetailRows
        layout="stacked"
        size="caption"
        gap="loose"
        rows={[
          { label: '한 번에', value: `${formatOkrw(perOrder)}까지` },
          { label: '주인', value: ownerVerified ? '실명 확인됨' : '실명 확인 전' },
          { label: '태어난 날', value: formatKstDate(bornAt) },
        ]}
      />
    </section>
  );
}
