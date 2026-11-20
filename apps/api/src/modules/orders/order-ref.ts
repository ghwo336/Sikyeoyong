import type { Hex } from '@sikyeoyong/shared';
import { keccak256, stringToBytes } from 'viem';

/**
 * The order's on-chain idempotency key: keccak256 of the order id's UTF-8 bytes
 * (payment.md "orderRef 멱등성"). Made once at quote time; rebuildable from the id
 * for recovery and for matching OrderPlaced events.
 */
export function orderRefOf(orderId: string): Hex {
  return keccak256(stringToBytes(orderId));
}
