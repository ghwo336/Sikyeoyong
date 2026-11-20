import { describe, expect, expectTypeOf, it } from 'vitest';
import { OWNER_ACTION_KINDS, type OwnerAction, type OwnerActionKind } from './owner.js';

describe('owner actions (D-24)', () => {
  it('lists exactly the owner-only actions of payment.md "소유자 서명 포트"', () => {
    expect(OWNER_ACTION_KINDS).toEqual([
      'setTransferLimit',
      'bind',
      'pause',
      'unpause',
      'drain',
      'fund',
    ]);
    expectTypeOf<OwnerAction['kind']>().toEqualTypeOf<OwnerActionKind>();
  });
});
