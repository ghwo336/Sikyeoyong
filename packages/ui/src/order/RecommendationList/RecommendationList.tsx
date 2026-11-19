import { formatOkrw } from '@sikyeoyong/shared';
import { Fragment } from 'react';
import { Skeleton } from '../../base/Skeleton';
import styles from './RecommendationList.module.css';

export interface Recommendation {
  readonly id: string;
  /** Store name ("마루국밥 본점"). */
  readonly store: string;
  /** Already formatted by the parent ("25분"). */
  readonly eta: string;
  readonly menu: string;
  /** aokrw. Shown with formatOkrw only. */
  readonly price: bigint;
  /** A new store: the owner has to say yes first. */
  readonly needsApproval?: boolean;
}

export interface RecommendationListProps {
  readonly items: readonly Recommendation[];
  readonly onPick: (id: string) => void;
  /** Skeleton rows while the server is still picking. */
  readonly loading?: boolean;
}

const SKELETON_ROWS = 3;

/** Draws 2 or 3 recommended stores and menus as one card (RecommendationList.md). */
export function RecommendationList({ items, onPick, loading = false }: RecommendationListProps) {
  if (loading) {
    return (
      <div className={styles.card} role="status" aria-busy="true" aria-label="추천 고르는 중">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Fragment key={i}>
            {i > 0 ? <div className={styles.divider} /> : null}
            <div className={styles.skeletonRow} data-part="skeleton">
              <Skeleton height="meta" width="40%" />
              <Skeleton height="meta" width="65%" />
            </div>
          </Fragment>
        ))}
      </div>
    );
  }
  // Nothing to pick: the dragon says so in its own line; the card stays out of the way.
  if (items.length === 0) return null;

  return (
    // role=list keeps the list meaning in Safari VoiceOver despite list-style: none.
    <ul className={styles.card} role="list">
      {items.map((item, i) => (
        <li key={item.id} className={styles.item}>
          {i > 0 ? <div className={styles.divider} aria-hidden="true" /> : null}
          <button
            type="button"
            className={styles.row}
            onClick={() => {
              onPick(item.id);
            }}
          >
            {/* The spaces between spans keep the button name readable: "가게, 25분 메뉴 9,000원". */}
            <span className={styles.text}>
              <span className={styles.meta}>
                {item.store}, {item.eta}
              </span>{' '}
              <span className={styles.menu}>{item.menu}</span>
            </span>{' '}
            <span className={styles.end}>
              <span className={styles.price}>{formatOkrw(item.price)}</span>
              {item.needsApproval ? (
                <>
                  {' '}
                  <span className={styles.badge}>허락 필요</span>
                </>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
