import type Anthropic from '@anthropic-ai/sdk';
import { kstDaysBetween } from '@sikyeoyong/shared';
import type { LlmProvider, LlmTurnRequest } from './llm-provider.js';

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

  constructor(
    /** The live Claude provider behind the cap (tests read its options). */
    readonly live: LlmProvider,
    private readonly fallback: LlmProvider,
    private readonly cap: number,
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
    if (this.cap > 0 && this.used >= this.cap) return this.fallback.turn(request, onText, signal);
    const message = await this.live.turn(request, onText, signal);
    this.used += message.usage.input_tokens + message.usage.output_tokens;
    return message;
  }

  private roll(): void {
    const today = kstDay(this.now());
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
  }
}
