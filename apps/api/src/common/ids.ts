import { randomBytes } from 'node:crypto';

/**
 * UUID v7 (RFC 9562): 48-bit unix ms timestamp, version 7, variant 10, random rest.
 * Internal IDs are UUID v7 text (data.md) so they sort by creation time.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs >= 2 ** 48) {
    throw new RangeError('uuidv7 timestamp out of range');
  }
  const bytes = randomBytes(16);
  let ts = nowMs;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
