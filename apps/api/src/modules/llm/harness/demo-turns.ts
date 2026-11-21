import type { ToolName } from '../tools/definitions.js';

/**
 * Hand-written dragon turns for the demo scenes (D-26, `pnpm demo:rehearse`). The replay
 * provider tries them before its generic plan. The tools are the real server ones, so cards and
 * numbers are real; only the dragon's words and which tool it calls are fixed here. A turn may
 * call read tools and the card tool (`propose_limit_change` shows a card and changes nothing);
 * never `place_order`, which only a tap on a card starts.
 */
export type DemoStep =
  | { readonly kind: 'tool'; readonly tool: ToolName; readonly input: unknown }
  | { readonly kind: 'line'; readonly line: string };

export interface DemoTurn {
  readonly name: string;
  /** The user's latest words (what they typed); the first turn that matches wins. */
  readonly matches: (words: string) => boolean;
  readonly steps: (words: string) => readonly DemoStep[];
}

/** Dishes a scene asks for by name. The dragon passes the name on as the craving. */
export const DEMO_DISHES = ['돼지국밥', '보쌈'] as const;

const dishIn = (words: string): string | undefined => DEMO_DISHES.find((d) => words.includes(d));

/** "5만 원" is 50000. Anything else is not a limit the dragon can read, so no card. */
export function wonAsked(words: string): number | undefined {
  const m = /(\d+)\s*만/.exec(words);
  return m?.[1] === undefined ? undefined : Number(m[1]) * 10_000;
}

export const DEMO_TURNS: readonly DemoTurn[] = [
  {
    // Scene 3: "한 번에 5만 원까지 올려 줘" -> the change card (the owner's tap changes it).
    name: 'raise-per-order',
    matches: (w) => /올려|늘려/.test(w) && wonAsked(w) !== undefined,
    steps: (w) => [
      {
        kind: 'tool',
        tool: 'propose_limit_change',
        input: { field: 'perOrder', amountOkrw: wonAsked(w) ?? 0 },
      },
      { kind: 'line', line: '이렇게 바꿔 볼까용? 확인해 주면 바로 시킬 수 있어용.' },
    ],
  },
  {
    // Scenes 2, 3, 4: a named dish -> the matching recommendations.
    name: 'named-dish',
    matches: (w) => dishIn(w) !== undefined,
    steps: (w) => [
      { kind: 'tool', tool: 'recommend_merchants', input: { craving: dishIn(w) ?? '' } },
      { kind: 'line', line: `${dishIn(w) ?? '이'} 골라 봤어용. 마음에 드는 걸 눌러 주세용.` },
    ],
  },
];
