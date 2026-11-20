/**
 * The recommender's view of the user's recent orders (tech-spec 3.8 preference
 * and novelty). Orders belong to the orders module, so the recommender never
 * reads the orders table; it asks through this port.
 */
export interface RecentOrdersReader {
  /** The user's counted orders (paid or later, no refunds) created at or after sinceMs. */
  since(userId: string, sinceMs: number): readonly { merchantId: string; createdAtMs: number }[];
}

export const RECENT_ORDERS = Symbol('RECENT_ORDERS');

/**
 * Bound until OrdersService exports a recent-orders read (worklog follow-up).
 * No orders can be paid before place_order lands, so this is also what the
 * orders table would say today. Preference and novelty are then neutral.
 */
export const NO_RECENT_ORDERS: RecentOrdersReader = { since: () => [] };
