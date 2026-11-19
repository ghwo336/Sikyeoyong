import { type Point, splitRoute, toPath, withRo } from './geometry';
import styles from './DeliveryMap.module.css';

export type { Point } from './geometry';

export interface DeliveryMapProps {
  /** Store pin, in map units (390 x 400 view). */
  readonly store: Point;
  readonly home: Point;
  /** Rider position. Missing in stage 1 (mock stores have no rider feed). */
  readonly rider?: Point;
  /** Road path from the store to home. */
  readonly route: readonly Point[];
  /** How much of the route is behind the rider, 0 to 1. */
  readonly progress: number;
  /** Names on the pins and in the description ("마루국밥", "회사"). */
  readonly storeName: string;
  readonly homeName: string;
}

const W = 390;
const H = 400;

/**
 * Draws the way from the store to home and the rider (DeliveryMap.md). Stage 1 is a
 * drawn map; a real map SDK can replace the inside later with the same props.
 */
export function DeliveryMap({
  store,
  home,
  rider,
  route,
  progress,
  storeName,
  homeName,
}: DeliveryMapProps) {
  const { done } = splitRoute(route, progress);
  const label = rider
    ? `라이더가 ${storeName}에서 ${withRo(homeName)} 오는 경로 지도`
    : `${storeName}에서 ${homeName}까지 경로 지도`;
  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Tracking.dc.html blocks and roads: decoration only. */}
      <g data-part="decor">
        <rect className={styles.ground} x="0" y="0" width={W} height={H} />
        <rect className={styles.block} x="20" y="70" width="120" height="90" rx="10" />
        <rect className={styles.block} x="170" y="70" width="90" height="60" rx="10" />
        <rect className={styles.block} x="290" y="150" width="90" height="110" rx="10" />
        <rect className={styles.block} x="20" y="200" width="150" height="70" rx="10" />
        <rect className={styles.block} x="200" y="290" width="170" height="80" rx="10" />
        <rect className={styles.park} x="30" y="300" width="80" height="70" rx="10" />
        <path className={styles.road} d="M0 180 H390" strokeWidth="14" />
        <path className={styles.road} d="M155 0 V400" strokeWidth="14" />
        <path className={styles.road} d="M275 40 V400" strokeWidth="10" />
        <path className={styles.road} d="M0 285 H390" strokeWidth="10" />
      </g>

      <path className={styles.ahead} d={toPath(route)} data-part="ahead" />
      {done.length > 1 ? (
        <path className={styles.behind} d={toPath(done)} data-part="behind" />
      ) : null}

      <g data-part="store" transform={`translate(${String(store.x)} ${String(store.y)})`}>
        <circle className={styles.storeDot} r="16" />
        <path className={styles.bowl} d="M-9 -2 H9 C9 4 5 8 0 8 C-5 8 -9 4 -9 -2 Z" />
        <path className={styles.steam} d="M-3 -6 Q-2 -9 -3 -11" />
        <path className={styles.steam} d="M2 -6 Q3 -9 2 -11" />
        <rect className={styles.tag} x="-40" y="-34" width="80" height="24" rx="12" />
        <text className={styles.tagText} y="-18" textAnchor="middle">
          {storeName}
        </text>
      </g>

      {rider ? (
        <g data-part="rider" transform={`translate(${String(rider.x)} ${String(rider.y)})`}>
          <circle className={styles.halo} r="20" />
          <circle className={styles.riderDot} r="13" />
          <circle className={styles.wheel} cx="-4" cy="2" r="2.4" />
          <circle className={styles.wheel} cx="5" cy="2" r="2.4" />
          <path className={styles.wheel} d="M-4 2 L0 -4 L5 2" />
        </g>
      ) : null}

      <g data-part="home" transform={`translate(${String(home.x)} ${String(home.y)})`}>
        <path
          className={styles.pin}
          d="M0 -17 C-12 -17 -16 -7 -16 0 C-16 11 0 21 0 21 C0 21 16 11 16 0 C16 -7 12 -17 0 -17 Z"
        />
        <ellipse className={styles.pinHole} cy="-1" rx="6" ry="7.5" />
        <rect className={styles.tag} x="-32" y="29" width="64" height="24" rx="12" />
        <text className={styles.tagText} y="45" textAnchor="middle">
          {homeName}
        </text>
      </g>
    </svg>
  );
}
