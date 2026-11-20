import { describe, expect, it } from 'vitest';
import { placeOrderReply } from './order-views.js';

describe('placeOrderReply', () => {
  it('treats any state other than a quote or a pending approval as a server bug', () => {
    expect(() =>
      placeOrderReply({ result: { order: { id: 'o1', status: 'paid' } }, approvalReason: null }),
    ).toThrow(expect.objectContaining({ code: 'INTERNAL' }));
  });
});
