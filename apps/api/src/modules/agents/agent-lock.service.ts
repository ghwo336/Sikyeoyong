import { Injectable } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';

/** Longest a caller waits for its turn, and longest one turn is held (a hung RPC must not block forever). */
export const AGENT_LOCK_WAIT_MS = 120_000;
export const AGENT_LOCK_HOLD_MS = 120_000;

export interface AgentLockLimits {
  waitMs: number;
  holdMs: number;
}

const DEFAULT_LIMITS: AgentLockLimits = { waitMs: AGENT_LOCK_WAIT_MS, holdMs: AGENT_LOCK_HOLD_MS };

/**
 * Thrown when a turn could not start in time (`phase` wait: fn never ran) or ran too long (`phase`
 * hold: fn may still be running and its outcome is unknown). The code is RATE_LIMITED ("잠시 후
 * 다시 시도해 주세요"), the reason says which.
 */
export class AgentLockTimeout extends AppError {
  constructor(readonly phase: 'wait' | 'hold') {
    super('RATE_LIMITED', {
      reason:
        phase === 'wait' ? 'agent busy: lock wait timed out' : 'agent busy: lock hold timed out',
    });
  }
}

/**
 * One owner action at a time per dragon (freeze, unfreeze, drain, confirm payment). The API is one
 * process on one SQLite file (D-03), so an in-process queue per agent id is enough. Without it an
 * unfreeze whose chain call is slow could finish after a later freeze and leave the dragon awake
 * while the owner was told it stopped (the kill switch must not quietly undo itself).
 *
 * Bounded: waiting for the turn takes at most waitMs, holding it at most holdMs. On a hold timeout
 * the turn is handed on and the caller gets AgentLockTimeout('hold'), but fn is not cancelled (it
 * cannot be, a payment may be out); whatever it recorded stays recorded.
 */
@Injectable()
export class AgentLock {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(
    agentId: string,
    fn: () => Promise<T>,
    limits: AgentLockLimits = DEFAULT_LIMITS,
  ): Promise<T> {
    const before = this.tails.get(agentId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const mine = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(agentId, mine);
    void mine.then(() => {
      if (this.tails.get(agentId) === mine) this.tails.delete(agentId);
    });

    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    const turn = await Promise.race([
      before.then(() => true),
      new Promise<false>((resolve) => {
        waitTimer = setTimeout(() => {
          resolve(false);
        }, limits.waitMs);
      }),
    ]);
    clearTimeout(waitTimer);
    if (!turn) {
      // Not our turn yet: the ones behind us must still wait for the one ahead.
      void before.then(release);
      throw new AgentLockTimeout('wait');
    }

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const running = (async () => fn())();
    void running.then(release, release);
    try {
      return await Promise.race([
        running,
        new Promise<never>((_, reject) => {
          holdTimer = setTimeout(() => {
            release();
            reject(new AgentLockTimeout('hold'));
          }, limits.holdMs);
        }),
      ]);
    } finally {
      clearTimeout(holdTimer);
    }
  }
}
