export interface Point {
  readonly x: number;
  readonly y: number;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Splits a route at `progress` (0 to 1, clamped) of its length.
 * `done` runs from the start to the cut point, `cut` is where the rider would be.
 */
export function splitRoute(
  route: readonly Point[],
  progress: number,
): { done: Point[]; cut: Point | undefined } {
  const first = route[0];
  if (!first) return { done: [], cut: undefined };
  // NaN starts at the store; anything else, Infinity too, is clamped to 0..1.
  const p = Number.isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress));
  let total = 0;
  for (let i = 1; i < route.length; i += 1) total += dist(route[i - 1] as Point, route[i] as Point);
  let left = total * p;
  const done: Point[] = [first];
  for (let i = 1; i < route.length; i += 1) {
    // Exactly at a corner (or at the start): stop there, no zero-length piece.
    if (left <= 0) break;
    const a = route[i - 1] as Point;
    const b = route[i] as Point;
    const seg = dist(a, b);
    if (left >= seg) {
      done.push(b);
      left -= seg;
      continue;
    }
    const t = seg === 0 ? 0 : left / seg;
    const cut = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    done.push(cut);
    return { done, cut };
  }
  return { done, cut: done[done.length - 1] };
}

export function toPath(points: readonly Point[]): string {
  return points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${String(pt.x)} ${String(pt.y)}`).join(' ');
}

/** "회사로", "집으로": picks 로 or 으로 from the last syllable (ㄹ takes 로). */
export function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}로`;
  const final = code % 28;
  return final === 0 || final === 8 ? `${word}로` : `${word}으로`;
}
