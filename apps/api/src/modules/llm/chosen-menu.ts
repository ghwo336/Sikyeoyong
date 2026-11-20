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

  /** Menu ids the user named in this message. */
  named(userText: string): string[] {
    const said = squash(userText);
    const out: string[] = [];
    for (const [id, name] of this.names) {
      const n = squash(name);
      if (n.length >= 2 && said.includes(n)) out.push(id);
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
