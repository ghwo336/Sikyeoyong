import { z } from 'zod';
import { zAokrwString } from '../money/money.js';

/**
 * Length caps for text that merchants write (tech-spec 9.2): names 40, descriptions 200.
 * The server clips stored text to these before any screen or the model sees it.
 */
export const MERCHANT_NAME_MAX = 40;
export const MENU_NAME_MAX = 40;
export const MENU_DESCRIPTION_MAX = 200;

const id = z.string().min(1).max(64);
const tag = z.string().min(1).max(20);

/** One merchant in GET /api/merchants (tech-spec 3.2 MerchantCard). */
export const zMerchantCard = z
  .object({
    id,
    name: z.string().min(1).max(MERCHANT_NAME_MAX),
    category: z.string().min(1).max(20),
    tags: z.array(tag).max(10),
    verified: z.boolean(),
    /** Open now by its KST opening hours. */
    openNow: z.boolean(),
    /** Minutes from order to arrival the merchant source gives. */
    etaMin: z
      .number()
      .int()
      .min(0)
      .max(24 * 60),
  })
  .strict();
export type MerchantCard = z.infer<typeof zMerchantCard>;

/** One menu in GET /api/merchants/:id. price is aokrw; the server DB is the only source of prices. */
export const zMenuView = z
  .object({
    id,
    name: z.string().min(1).max(MENU_NAME_MAX),
    price: zAokrwString,
    tags: z.array(tag).max(10),
    description: z.string().max(MENU_DESCRIPTION_MAX),
    available: z.boolean(),
  })
  .strict();
export type MenuView = z.infer<typeof zMenuView>;

/**
 * GET /api/merchants query. Users only ever see verified, active merchants
 * (merchants.md MUST), so `verified` takes `true` only; anything else is 400.
 */
export const zMerchantListQuery = z
  .object({
    category: z.string().min(1).max(20).optional(),
    verified: z.literal('true').optional(),
  })
  .strict();
export type MerchantListQuery = z.infer<typeof zMerchantListQuery>;

/** GET /api/merchants/:id path parameter. */
export const zMerchantIdParam = id;

export const zMerchantList = z.object({ merchants: z.array(zMerchantCard) }).strict();
export type MerchantList = z.infer<typeof zMerchantList>;

export const zMerchantDetail = z
  .object({ merchant: zMerchantCard, menus: z.array(zMenuView) })
  .strict();
export type MerchantDetail = z.infer<typeof zMerchantDetail>;
