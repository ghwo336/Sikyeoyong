import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema';
import { LIMIT_FIELDS } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { TOOL_DEFINITIONS, TOOL_INPUTS, TOOL_KIND } from './definitions.js';

// verify-allow: R4 independent oracle for expected values, not production code
const OKRW = 10n ** 18n;

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

  it('has one order, one approval and one card tool; everything else only reads', () => {
    expect(Object.entries(TOOL_KIND).filter(([, k]) => k !== 'read')).toEqual([
      ['place_order', 'order'],
      ['request_owner_approval', 'approval'],
      ['propose_limit_change', 'card'],
    ]);
  });

  it('takes no paid amount, address or wallet field in any tool', () => {
    const fields = TOOL_DEFINITIONS.flatMap((t) =>
      Object.keys((t.input_schema.properties ?? {}) as Record<string, unknown>),
    );
    const known = ['maxPriceOkrw', 'amountOkrw'];
    for (const f of fields.filter((x) => !known.includes(x))) {
      expect(f).not.toMatch(/amount|aokrw|okrw|address|wallet|to$|value|price/i);
    }
    // maxPriceOkrw is a search filter for recommendations; amountOkrw is the limit card's asked
    // amount (D-31), shown on a card only and range-checked by the server. Neither moves money.
    expect(fields.filter((f) => /okrw/i.test(f))).toEqual(known);
    const owner = TOOL_DEFINITIONS.find((t) =>
      Object.keys((t.input_schema.properties ?? {}) as Record<string, unknown>).includes(
        'amountOkrw',
      ),
    );
    expect(owner?.name).toBe('propose_limit_change');
  });

  it('is strict and closed: every schema forbids extra fields', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(t.strict, t.name).toBe(true);
      expect(t.input_schema.additionalProperties, t.name).toBe(false);
    }
  });

  // Strict mode rejects keywords it does not support (minimum, maxLength, ...). The SDK's own
  // transformer moves those into the description, so a schema it leaves unchanged is safe to send.
  it.each(TOOL_DEFINITIONS.map((t) => [t.name, t] as const))(
    '%s schema is a fixed point of the SDK strict transform',
    (_name, t) => {
      expect(transformJSONSchema(t.input_schema)).toEqual(t.input_schema);
    },
  );

  it('keeps the card field enum in step with shared LIMIT_FIELDS (D-31)', () => {
    const props = TOOL_DEFINITIONS.find((t) => t.name === 'propose_limit_change')?.input_schema
      .properties as Record<string, { enum?: unknown[] }>;
    expect(props.field?.enum).toEqual([...LIMIT_FIELDS]);
    expect(Object.keys(props)).toEqual(['field', 'amountOkrw']);
  });

  it('turns the limit card amount into aokrw bigint before a handler sees it (D-31)', () => {
    const card = TOOL_INPUTS.propose_limit_change;
    expect(card.parse({ field: 'perOrder', amountOkrw: 45_000 })).toEqual({
      field: 'perOrder',
      amountAokrw: 45_000n * OKRW,
    });
    for (const bad of [
      { field: 'perOrder', amountOkrw: 1.5 },
      { field: 'perOrder', amountOkrw: -1 },
      { field: 'monthlyBudget', amountOkrw: 10_000 },
      { field: 'perOrder', targetLevel: 3 },
      { field: 'perOrder', amountOkrw: 10_000, toAokrw: '1' },
    ]) {
      expect(card.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('turns the whole-won price filter into aokrw bigint before a handler sees it', () => {
    const parsed = TOOL_INPUTS.recommend_merchants.parse({ craving: '국물', maxPriceOkrw: 9_000 });
    expect(parsed).toEqual({ craving: '국물', maxPriceAokrw: 9_000n * OKRW });
    expect(TOOL_INPUTS.recommend_merchants.parse({})).toEqual({});
    expect(TOOL_INPUTS.recommend_merchants.safeParse({ maxPriceOkrw: 1_000_001 }).success).toBe(
      false,
    );
    expect(TOOL_INPUTS.recommend_merchants.safeParse({ maxPriceOkrw: 1.5 }).success).toBe(false);
  });
});
