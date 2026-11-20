/**
 * Where merchants come from (tech-spec 3.5, architecture.md "바꿔 끼우는 것은 인터페이스로").
 * Phase 1 reads the seeded rows; phase 2 merchants registered in the console live in
 * the same tables. A real partner source would be another implementation.
 * Records are raw: visibility, opening hours and text caps are MerchantsService rules.
 */
export interface MerchantRecord {
  readonly id: string;
  readonly onchainId: string | null;
  /** seed: the mock stores (tech-spec 7.1); console: registered by a store (phase 2). */
  readonly source: 'seed' | 'console';
  readonly name: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly verified: boolean;
  readonly active: boolean;
  /** { "mon-sun": "10:00-22:00" } in KST (tech-spec 7.1). */
  readonly openHours: Readonly<Record<string, string>>;
  /** Minutes from order to arrival as this source knows it. */
  readonly etaMin: number;
}

export interface MenuRecord {
  readonly id: string;
  readonly merchantId: string;
  readonly name: string;
  readonly priceAokrw: bigint;
  readonly tags: readonly string[];
  readonly description: string;
  readonly available: boolean;
}

export interface MerchantSource {
  list(filter: { readonly category?: string }): MerchantRecord[];
  get(id: string): MerchantRecord | null;
  menus(merchantId: string): MenuRecord[];
}

export const MERCHANT_SOURCE = Symbol('MERCHANT_SOURCE');
