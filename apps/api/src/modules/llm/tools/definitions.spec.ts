import { describe, expect, it } from 'vitest';
import { TOOL_DEFINITIONS, TOOL_INPUTS, TOOL_KIND } from './definitions.js';

// Tool whitelist comparison (testing.md, CLAUDE.md rule 3, D-06, D-21).
// Any new tool must be added here on purpose, after a decisions.md entry.
const ALLOWED = [
  'get_budget',
  'get_order_history',
  'get_context',
  'recommend_merchants',
  'get_menu',
  'place_order',
  'request_owner_approval',
  'propose_limit_change',
];

describe('LLM tool whitelist', () => {
  it('sends exactly the allowed tools, in a fixed order', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name)).toEqual(ALLOWED);
    expect(Object.keys(TOOL_INPUTS)).toEqual(ALLOWED);
    expect(Object.keys(TOOL_KIND)).toEqual(ALLOWED);
  });

  it('has only two writes and one card; everything else only reads', () => {
    expect(Object.entries(TOOL_KIND).filter(([, k]) => k !== 'read')).toEqual([
      ['place_order', 'write'],
      ['request_owner_approval', 'write'],
      ['propose_limit_change', 'card'],
    ]);
  });

  it('takes no amount, address or wallet field in any tool', () => {
    const fields = TOOL_DEFINITIONS.flatMap((t) =>
      Object.keys((t.input_schema.properties ?? {}) as Record<string, unknown>),
    );
    for (const f of fields.filter((x) => x !== 'maxPriceOkrw')) {
      expect(f).not.toMatch(/amount|aokrw|okrw|address|wallet|to$|value|price/i);
    }
    // maxPriceOkrw is a search filter for recommendations, not money that moves.
    expect(fields.filter((f) => /okrw/i.test(f))).toEqual(['maxPriceOkrw']);
  });

  it('is strict and closed: every schema forbids extra fields', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(t.strict, t.name).toBe(true);
      expect(t.input_schema.additionalProperties, t.name).toBe(false);
    }
  });
});
