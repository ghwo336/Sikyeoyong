/**
 * Guard against a silent menu swap (browser QA 3): the user named a menu and the
 * dragon put up a confirm card for another one. The runtime remembers the menus the
 * model has seen in tool results (get_menu, recommend_merchants). If the user's own
 * words name one of them, place_order must contain it; a different menu needs the
 * user's choice first (recommendation cards), never a confirm card.
 */
export class MenuCatalog {
  private readonly names = new Map<string, string>();

  /** Reads the menus out of what the model was given (display words and ids only). */
  learn(output: unknown): void {
    if (typeof output !== 'object' || output === null) return;
    const rec = output as Record<string, unknown>;
    for (const key of ['menus', 'candidates']) {
      const list = rec[key];
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        if (typeof m !== 'object' || m === null) continue;
        const { menuId, menu } = m as Record<string, unknown>;
        if (typeof menuId === 'string' && typeof menu === 'string') this.names.set(menuId, menu);
      }
    }
  }

  /** Menu ids the user named in this message, leaving out names said with a refusal. */
  named(userText: string): string[] {
    const said = squash(userText);
    const out: string[] = [];
    for (const [id, name] of this.names) {
      const n = squash(name);
      if (n.length < 2) continue;
      for (let at = said.indexOf(n); at !== -1; at = said.indexOf(n, at + 1)) {
        if (!refused(said, at, at + n.length)) {
          out.push(id);
          break;
        }
      }
    }
    return out;
  }

  /** The names the user asked for when the order leaves all of them out, else null. */
  swappedAway(userText: string, orderedMenuIds: readonly string[]): string[] | null {
    const named = this.named(userText);
    if (named.length === 0 || named.some((id) => orderedMenuIds.includes(id))) return null;
    return named.flatMap((id) => this.names.get(id) ?? []);
  }
}

function squash(s: string): string {
  return s.replace(/\s+/g, '');
}

/** Words that turn a menu name into one the user does NOT want ("X 말고", "X 대신", "싫어 X"). */
const REFUSAL = /말고|말구|빼고|대신|제외|싫|아니|안먹|안 ?시/;

function refused(said: string, from: number, to: number): boolean {
  // Before the name only a plain "don't want" counts; "A 말고 B" must not refuse B.
  return (
    REFUSAL.test(said.slice(to, to + 6)) ||
    /싫|아니|제외/.test(said.slice(Math.max(0, from - 3), from))
  );
}
