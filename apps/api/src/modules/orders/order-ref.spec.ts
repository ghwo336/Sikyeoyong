import { describe, expect, it } from 'vitest';
import { orderRefOf } from './order-ref.js';

describe('orderRefOf (payment.md: keccak of the order id)', () => {
  it('is Keccak-256 of the UTF-8 id (published test vectors, not SHA3-256)', () => {
    expect(orderRefOf('')).toBe(
      '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
    expect(orderRefOf('abc')).toBe(
      '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    );
  });

  it('is the same for the same id and differs between ids', () => {
    const id = '019a9f00-0000-7000-8000-000000000001';
    expect(orderRefOf(id)).toBe(orderRefOf(id));
    expect(orderRefOf(id)).not.toBe(orderRefOf('019a9f00-0000-7000-8000-000000000002'));
  });
});
