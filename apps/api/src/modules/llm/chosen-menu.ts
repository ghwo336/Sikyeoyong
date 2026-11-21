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

  /**
   * Menu ids the user named in this message, leaving out names said with a refusal.
   * A full name counts. So does a partial word of 2+ Korean chars ("국밥 시켜 줘" for
   * 돼지국밥) when exactly one menu name the model saw contains it; an ambiguous
   * partial names nothing.
   */
  named(userText: string): string[] {
    const said = squash(userText);
    const out = new Set<string>();
    for (const [id, name] of this.names) {
      const n = squash(name);
      if (n.length >= 2 && saidWithoutRefusal(said, n)) out.add(id);
    }
    const squashed = new Map<string, string[]>();
    for (const [id, name] of this.names) {
      const n = squash(name);
      squashed.set(n, [...(squashed.get(n) ?? []), id]);
    }
    for (const word of userText.match(/[가-힣]{2,}/g) ?? []) {
      const hits = [...squashed.keys()].filter((n) => n.includes(word));
      if (hits.length !== 1 || !saidWithoutRefusal(said, word)) continue;
      for (const id of squashed.get(hits[0] as string) ?? []) out.add(id);
    }
    return [...out];
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

function saidWithoutRefusal(said: string, word: string): boolean {
  for (let at = said.indexOf(word); at !== -1; at = said.indexOf(word, at + 1)) {
    if (!refused(said, at, at + word.length)) return true;
  }
  return false;
}

/** Words after a menu name that mean the user does NOT want it ("X 말고", "X 별로", "X 안 땡겨"). */
const REFUSAL = /말고|말구|빼고|대신|제외|싫|별로|질렸|됐어|안먹|안시|안땡/;
// "A 아니고 B" refuses A only, and only right after the name.
// "A 아니고 B" refuses A; "A 아니면 B" is a choice, not a refusal.
const NOT_IT = /^.{0,2}아니(?!면)/;

function refused(said: string, from: number, to: number): boolean {
  // Before the name only a plain "don't want" counts; "A 말고 B" and an interjection
  // "아니 B" must not refuse B.
  const after = said.slice(to, to + 6);
  return (
    REFUSAL.test(after) ||
    NOT_IT.test(after) ||
    /싫|제외/.test(said.slice(Math.max(0, from - 3), from))
  );
}
