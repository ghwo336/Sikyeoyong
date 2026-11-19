import type Anthropic from '@anthropic-ai/sdk';
import { AGENT_LEVELS, MONTHLY_BUDGET_OPTION_IDS } from '@sikyeoyong/shared';
import { z } from 'zod';

/**
 * The whole tool surface Claude gets (agent-runtime.md, tech-spec 3.3, D-06, D-21).
 * No tool takes an amount, an address or a policy value. Nothing here moves money:
 * place_order only makes a quote and a confirm card, propose_limit_change only a card.
 * Adding a tool needs a decisions.md entry and a security review first.
 */
export type ToolKind = 'read' | 'write' | 'card';

const idString = z.string().min(1).max(64);

export const TOOL_INPUTS = {
  get_budget: z.object({}).strict(),
  get_order_history: z.object({ days: z.number().int().min(1).max(60) }).strict(),
  get_context: z.object({}).strict(),
  recommend_merchants: z
    .object({
      craving: z.string().max(50).optional(),
      maxPriceOkrw: z.number().int().min(0).optional(),
    })
    .strict(),
  get_menu: z.object({ merchantId: idString }).strict(),
  place_order: z
    .object({
      merchantId: idString,
      items: z
        .array(z.object({ menuId: idString, qty: z.number().int().min(1).max(20) }).strict())
        .min(1)
        .max(10),
      note: z.string().max(100).optional(),
    })
    .strict(),
  request_owner_approval: z
    .object({
      reason: z.enum(['OVER_LEVEL_LIMIT', 'NEW_MERCHANT', 'OVER_PERSONAL_BUDGET']),
      merchantId: idString.optional(),
      items: z
        .array(z.object({ menuId: idString, qty: z.number().int().min(1).max(20) }).strict())
        .max(10)
        .optional(),
      message: z.string().max(200).optional(),
    })
    .strict(),
  propose_limit_change: z
    .object({
      field: z.enum(['perOrder', 'monthlyBudget']),
      targetLevel: z
        .number()
        .int()
        .refine((n) => (AGENT_LEVELS as readonly number[]).includes(n))
        .optional(),
      budgetOption: z.enum(MONTHLY_BUDGET_OPTION_IDS as [string, ...string[]]).optional(),
    })
    .strict()
    .refine(
      (v) =>
        v.field === 'perOrder'
          ? v.targetLevel !== undefined && v.budgetOption === undefined
          : v.budgetOption !== undefined && v.targetLevel === undefined,
      { message: 'perOrder needs targetLevel only, monthlyBudget needs budgetOption only' },
    ),
} as const;

export type ToolName = keyof typeof TOOL_INPUTS;
export type ToolInput<N extends ToolName> = z.infer<(typeof TOOL_INPUTS)[N]>;

export const TOOL_KIND: { readonly [N in ToolName]: ToolKind } = {
  get_budget: 'read',
  get_order_history: 'read',
  get_context: 'read',
  recommend_merchants: 'read',
  get_menu: 'read',
  place_order: 'write',
  request_owner_approval: 'write',
  propose_limit_change: 'card',
};

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(TOOL_INPUTS, name);
}

const items = {
  type: 'array',
  minItems: 1,
  maxItems: 10,
  items: {
    type: 'object',
    properties: {
      menuId: { type: 'string' },
      qty: { type: 'integer', minimum: 1, maximum: 20 },
    },
    required: ['menuId', 'qty'],
    additionalProperties: false,
  },
} as const;

/** Definitions sent to Claude, in a fixed order so the prompt cache prefix stays stable. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_budget',
    description:
      '이번 달 개인 예산, 사용액, 체인 30일 상한과 리셋 시각, 레벨과 건당 한도, 예산 선택지를 조회한다.',
    strict: true,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_order_history',
    description: '최근 주문 기록을 조회한다.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', minimum: 1, maximum: 60 } },
      required: ['days'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_context',
    description: '현재 시각(KST), 사용자 기본 주소 동네, 날씨 요약을 조회한다.',
    strict: true,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'recommend_merchants',
    description: '예산, 날씨, 기록을 반영해 주문 가능한 가게와 메뉴 후보를 최대 3개 돌려준다.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        craving: { type: 'string', maxLength: 50, description: '사용자가 말한 먹고 싶은 것' },
        maxPriceOkrw: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_menu',
    description: '가게의 메뉴와 가격을 조회한다.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { merchantId: { type: 'string' } },
      required: ['merchantId'],
      additionalProperties: false,
    },
  },
  {
    name: 'place_order',
    description:
      '가게 주문의 견적과 확인 카드를 만든다. 결제는 사용자가 카드 버튼을 누를 때 서버가 한다. 금액은 서버가 메뉴 가격으로 계산한다.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        merchantId: { type: 'string' },
        items,
        note: { type: 'string', maxLength: 100 },
      },
      required: ['merchantId', 'items'],
      additionalProperties: false,
    },
  },
  {
    name: 'request_owner_approval',
    description: '한도 초과나 처음 보는 가게처럼 주인 승인이 필요할 때 승인을 요청한다.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['OVER_LEVEL_LIMIT', 'NEW_MERCHANT', 'OVER_PERSONAL_BUDGET'],
        },
        merchantId: { type: 'string' },
        items: { ...items, minItems: 0 },
        message: { type: 'string', maxLength: 200 },
      },
      required: ['reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_limit_change',
    description:
      '사용자가 한도나 예산을 바꾸자고 직접 말했을 때만 변경 카드를 띄운다. 아무것도 바꾸지 않는다. 바꾸는 일은 사용자가 카드 버튼을 누른 뒤 서버가 한다.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        field: { type: 'string', enum: ['perOrder', 'monthlyBudget'] },
        targetLevel: { type: 'integer', enum: [1, 2, 3] },
        budgetOption: { type: 'string', enum: ['small', 'medium', 'large'] },
      },
      required: ['field'],
      additionalProperties: false,
    },
  },
];
