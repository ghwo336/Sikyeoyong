import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { users } from '../../db/schema/index.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

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
  return new UsersService(new UsersRepository(h));
}

describe('UsersService', () => {
  it('reads the monthly budget as aokrw bigint', () => {
    expect(service().getMonthlyBudgetAokrw('u1')).toBe(okrwToAokrw(300_000n));
  });

  it('answers NOT_FOUND for an unknown user', () => {
    const s = service();
    expect(() => s.getMonthlyBudgetAokrw('nobody')).toThrow(AppError);
    try {
      s.getMonthlyBudgetAokrw('nobody');
    } catch (e) {
      expect((e as AppError).code).toBe('NOT_FOUND');
    }
  });
});
