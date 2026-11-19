import { Injectable } from '@nestjs/common';

export interface RateRule {
  readonly limit: number;
  readonly windowMs: number;
}

/**
 * Sliding-window counter in memory (tech-spec 9.5). The API runs as one process
 * on SQLite, so one map is the whole truth; a restart forgets the counts, which
 * only ever errs toward letting a user through.
 */
@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** Records a hit and answers whether it is within the rule. A refused hit is not counted. */
  /** Keys with a hit in their window (for tests: quiet users must not pile up). */
  get size(): number {
    return this.hits.size;
  }

  allow(key: string, rule: RateRule, nowMs: number = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > nowMs - rule.windowMs);
    if (recent.length === 0) this.hits.delete(key);
    if (recent.length >= rule.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return true;
  }
}
