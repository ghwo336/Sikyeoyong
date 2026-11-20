import type { Point } from '@sikyeoyong/ui';

/**
 * The Tracking design's one road (390×400 picture coordinates): the store bottom left,
 * home top right. Mock stores have no real places; the real map comes with delivery data.
 */
export const DEMO_ROAD = {
  store: { x: 70, y: 320 },
  home: { x: 315, y: 85 },
  route: [
    { x: 70, y: 320 },
    { x: 70, y: 230 },
    { x: 200, y: 230 },
    { x: 200, y: 85 },
    { x: 315, y: 85 },
  ],
} as const satisfies { store: Point; home: Point; route: readonly Point[] };

/**
 * How far the rider is (0 to 1) from the minutes left: the server only says minutes, so
 * the last RIDE_MIN minutes are the ride. Out of range clamps.
 */
export const RIDE_MIN = 12;
export function riderProgress(remainingMin: number): number {
  return Math.min(1, Math.max(0, (RIDE_MIN - remainingMin) / RIDE_MIN));
}
