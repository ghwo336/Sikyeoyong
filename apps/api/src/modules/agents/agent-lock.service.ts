import { Injectable } from '@nestjs/common';

/**
 * One owner action at a time per dragon (freeze, unfreeze, drain). The API is one process on one
 * SQLite file (D-03), so an in-process queue per agent id is enough. Without it an unfreeze whose
 * chain call is slow could finish after a later freeze and leave the dragon awake while the owner
 * was told it stopped (the kill switch must not quietly undo itself).
 */
@Injectable()
export class AgentLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(agentId: string, fn: () => Promise<T>): Promise<T> {
    const before = this.tails.get(agentId) ?? Promise.resolve();
    const result = before.catch(() => undefined).then(fn);
    const tail = result.catch(() => undefined);
    this.tails.set(agentId, tail);
    void tail.then(() => {
      if (this.tails.get(agentId) === tail) this.tails.delete(agentId);
    });
    return result;
  }
}
