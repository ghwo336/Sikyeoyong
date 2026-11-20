import { okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { users } from '../../db/schema/index.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';
import { loadConfig } from '../../config/env.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

function service() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  h.db
    .insert(users)
    .values({
      id: 'u1',
      nickname: '주인님',
      monthlyBudgetAokrw: '300000000000000000000000',
      createdAt: 1,
    })
    .run();
  return new UsersService(new UsersRepository(h), loadConfig({}));
}

describe('UsersService', () => {
  it('reads the monthly budget as aokrw bigint', () => {
    expect(service().getMonthlyBudgetAokrw('u1')).toBe(okrwToAokrw(300_000n));
  });

  it('answers NOT_FOUND for an unknown user', () => {
    expect(() => service().getMonthlyBudgetAokrw('nobody')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  it('reads the address neighborhood, null when unset', () => {
    const s = service();
    expect(s.getAddressDong('u1')).toBeNull();
    expect(() => s.getAddressDong('nobody')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  it('sets the monthly budget to a policy option only (D-21)', () => {
    const s = service();
    expect(s.setMonthlyBudget('u1', okrwToAokrw(500_000n))).toEqual({
      user: { nickname: '주인님', monthlyBudget: '500000000000000000000000' },
    });
    expect(s.getMonthlyBudgetAokrw('u1')).toBe(okrwToAokrw(500_000n));
    for (const bad of [okrwToAokrw(250_000n), okrwToAokrw(500_000n) + 1n, 0n]) {
      expect(() => s.setMonthlyBudget('u1', bad)).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    }
    expect(s.getMonthlyBudgetAokrw('u1')).toBe(okrwToAokrw(500_000n));
    expect(() => s.setMonthlyBudget('nobody', okrwToAokrw(200_000n))).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });
});
