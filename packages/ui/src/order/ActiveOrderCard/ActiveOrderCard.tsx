import { Icon } from '../../base/Icon';
import { StepProgress } from '../../base/StepProgress';
import styles from './ActiveOrderCard.module.css';

export interface ActiveOrderCardProps {
  /** What was ordered, already worded by the parent ("돼지국밥", "돼지국밥 외 1개"). */
  readonly menu: string;
  /** Where it is now ("주문 접수", "조리 중", "배달 중"). */
  readonly status: string;
  /** The time line, already worded ("가게가 확인 중", "8분 남았어요"). */
  readonly eta: string;
  /** Step names in order, the same as the status screens (Done.dc.html). */
  readonly steps: readonly string[];
  /** 1-based step the order is on. */
  readonly current: number;
  /** Opens the order's status screen. */
  readonly onPress: () => void;
}

/** Draws the order on its way under the budget card: what, where it is, its steps (ActiveOrderCard.md). */
export function ActiveOrderCard({
  menu,
  status,
  eta,
  steps,
  current,
  onPress,
}: ActiveOrderCardProps) {
  return (
    <button
      type="button"
      className={styles.card}
      aria-label={`진행 중인 주문: ${menu} ${status}, ${eta}`}
      onClick={onPress}
    >
      <span className={styles.mark} aria-hidden="true">
        <Icon name="scooter" className={styles.markIcon} />
      </span>
      <span className={styles.body} aria-hidden="true">
        <span className={styles.top}>
          <span className={styles.title}>
            {menu} {status}
          </span>
          <span className={styles.eta}>{eta}</span>
        </span>
        <StepProgress steps={steps} current={current} />
      </span>
      <Icon name="chevron-right" className={styles.chevron} />
    </button>
  );
}
