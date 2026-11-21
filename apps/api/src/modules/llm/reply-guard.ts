import { Logger } from '@nestjs/common';
import { checkReplyRules, type RuleFailure } from './reply-rules.js';
import type { JudgeVerdict, ReplyJudge } from './reply-judge.js';
import { TIRED_LINE } from './replay-provider.js';

/**
 * D-35: every visible reply of the dragon is checked on the server before the user sees it.
 * Layer 1 is the rule check (length, code, lists, tone, address, forbidden words), layer 2 the
 * topic judge. Any failure, timeout or unclear answer blocks (fail closed). The caller shows the
 * fixed scope line for a blocked reply. The log carries a fixed reason word only, never text.
 */
export const REPLY_GUARD = Symbol('REPLY_GUARD');

export type GuardReason = RuleFailure | Exclude<JudgeVerdict, 'PASS'>;
export type GuardResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: GuardReason };

/** Server-made lines that are known good and are never judged. */
const TRUSTED_LINES: ReadonlySet<string> = new Set([TIRED_LINE]);

export class ReplyGuard {
  private readonly logger = new Logger('ReplyGuard');

  /** judge null = rule check only (replay mode and tests: no live model words to judge). */
  constructor(private readonly judge: ReplyJudge | null = null) {}

  async vet(text: string, userId?: string, signal?: AbortSignal): Promise<GuardResult> {
    if (TRUSTED_LINES.has(text.trim())) return { ok: true };
    const rule = checkReplyRules(text);
    if (rule !== null) return this.block(rule);
    if (this.judge === null) return { ok: true };
    const verdict = await this.judge.judge(text, userId, signal);
    return verdict === 'PASS' ? { ok: true } : this.block(verdict);
  }

  private block(reason: GuardReason): GuardResult {
    this.logger.warn(`reply blocked: ${reason}`);
    return { ok: false, reason };
  }
}
