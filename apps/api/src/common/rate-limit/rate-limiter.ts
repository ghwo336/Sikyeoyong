import { Injectable } from '@nestjs/common';

export interface RateRule {
  readonly limit: number;
  readonly windowMs: number;
}

interface Entry {
  hits: number[];
  /** The rule's window, so a sweep never drops a key early for a longer rule. */
  windowMs: number;
}

/** How often allow() also sweeps out keys whose window has emptied. */
export const SWEEP_EVERY_MS = 60_000;

/**
 * Sliding-window counter in memory (tech-spec 9.5). The API runs as one process
 * on SQLite, so one map is the whole truth; a restart forgets the counts, which
 * only ever errs toward letting a user through. Keys of users who went quiet are
 * swept out on later calls, so the map holds only keys with a hit in their window.
 */
@Injectable()
export class RateLimiter {
  private readonly entries = new Map<string, Entry>();
  private lastSweep = Number.NEGATIVE_INFINITY;

  /** Keys currently held (for tests: quiet users must not pile up). */
  get size(): number {
    return this.entries.size;
  }

  /** Records a hit and answers whether it is within the rule. A refused hit is not counted. */
  allow(key: string, rule: RateRule, nowMs: number = Date.now()): boolean {
    if (nowMs - this.lastSweep >= SWEEP_EVERY_MS) this.sweep(nowMs);
    const recent = (this.entries.get(key)?.hits ?? []).filter((t) => t > nowMs - rule.windowMs);
    if (recent.length >= rule.limit) {
      this.entries.set(key, { hits: recent, windowMs: rule.windowMs });
      return false;
    }
    recent.push(nowMs);
    this.entries.set(key, { hits: recent, windowMs: rule.windowMs });
    return true;
  }

  private sweep(nowMs: number): void {
    this.lastSweep = nowMs;
    for (const [key, entry] of this.entries) {
      const newest = entry.hits.at(-1);
      if (newest === undefined || newest <= nowMs - entry.windowMs) this.entries.delete(key);
    }
  }
}
