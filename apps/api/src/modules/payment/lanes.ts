/**
 * Runs async jobs one after another per key (a promise chain), so two writes from the same
 * signer never read the same nonce. Jobs for different keys run in parallel. A failed job does
 * not block the next one.
 */
export class Lanes {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, job: () => Promise<T>): Promise<T> {
    const k = key.toLowerCase();
    const prev = this.tails.get(k) ?? Promise.resolve();
    const next = prev.then(job, job);
    const tail = next.catch(() => undefined);
    this.tails.set(k, tail);
    void tail.then(() => {
      if (this.tails.get(k) === tail) this.tails.delete(k);
    });
    return next;
  }
}
