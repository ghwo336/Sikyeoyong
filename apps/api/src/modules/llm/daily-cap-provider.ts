import type Anthropic from '@anthropic-ai/sdk';
import { kstDaysBetween } from '@sikyeoyong/shared';
import type { LlmProvider, LlmTurnRequest } from './llm-provider.js';

/**
 * Every token the turn was billed for: plain input, output, and the cached prompt both
 * written and read (the adapter caches the system prompt and the conversation, so most of a
 * long chat's input arrives as cache tokens, not input_tokens).
 */
export function tokensOf(usage: Anthropic.Usage): number {
  return (
    usage.input_tokens +
    usage.output_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  );
}

/** The KST calendar day of a time, as a day number (shared KST helper, server-api.md). */
function kstDay(nowMs: number): number {
  return kstDaysBetween(0, nowMs);
}

/**
 * D-26: a ceiling on live Claude tokens per KST day. Each turn's input and output tokens
 * are counted; once the day's count reaches the cap, the rest of the day is served by the
 * fallback (replay). One process on SQLite, so the count lives in memory; a restart starts
 * it over, which only errs toward allowing more. cap 0 means no cap.
 */
export class DailyCapProvider implements LlmProvider {
  private day = Number.NaN;
  private used = 0;
  private readonly usedByUser = new Map<string, number>();

  constructor(
    /** The live Claude provider behind the cap (tests read its options). */
    readonly live: LlmProvider,
    private readonly fallback: LlmProvider,
    private readonly cap: number,
    /** Per user, same counting and KST day; 0 means none. A turn with no userId is outside it. */
    private readonly userCap: number = 0,
    private readonly now: () => number = Date.now,
  ) {}

  /** Tokens counted today (for tests and logs). */
  get usedToday(): number {
    this.roll();
    return this.used;
  }

  async turn(
    request: LlmTurnRequest,
    onText: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<Anthropic.Message> {
    this.roll();
    const { userId } = request;
    const mine = userId === undefined ? 0 : (this.usedByUser.get(userId) ?? 0);
    if (this.cap > 0 && this.used >= this.cap) return this.fallback.turn(request, onText, signal);
    // One user's own ceiling: the same tired line, so a loop of resends cannot drain the day.
    if (this.userCap > 0 && mine >= this.userCap) {
      return this.fallback.turn(request, onText, signal);
    }
    const message = await this.live.turn(request, onText, signal);
    const tokens = tokensOf(message.usage);
    this.roll(); // the turn awaited, and the day may have rolled meanwhile
    this.used += tokens;
    if (userId !== undefined) {
      this.usedByUser.set(userId, (this.usedByUser.get(userId) ?? 0) + tokens);
    }
    return message;
  }

  /**
   * D-35: the reply judge spends tokens too, against the same per-user and daily caps. It asks
   * first and, once a cap is reached, makes no call (the reply then does not pass).
   */
  exhausted(userId: string): boolean {
    this.roll();
    if (this.cap > 0 && this.used >= this.cap) return true;
    return this.userCap > 0 && (this.usedByUser.get(userId) ?? 0) >= this.userCap;
  }

  charge(userId: string, tokens: number): void {
    this.roll();
    this.used += tokens;
    this.usedByUser.set(userId, (this.usedByUser.get(userId) ?? 0) + tokens);
  }

  /** Tokens one user spent today (for tests and logs). */
  usedTodayBy(userId: string): number {
    this.roll();
    return this.usedByUser.get(userId) ?? 0;
  }

  private roll(): void {
    const today = kstDay(this.now());
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
      this.usedByUser.clear();
    }
  }
}
