import { okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { users } from '../../db/schema/index.js';
import { UsersRepository } from './users.repository.js';
import { clampToRange, UsersService } from './users.service.js';
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
      myPeriodicLimitAokrw: '300000000000000000000000',
      createdAt: 1,
    })
    .run();
  return new UsersService(new UsersRepository(h), loadConfig({}));
}

describe('UsersService', () => {
  it('reads the 30-day limit as aokrw bigint', () => {
    expect(service().getMyPeriodicLimitAokrw('u1')).toBe(okrwToAokrw(300_000n));
  });

  it('answers NOT_FOUND for an unknown user', () => {
    expect(() => service().getMyPeriodicLimitAokrw('nobody')).toThrow(
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

  it('sets the 30-day limit only inside the range and on a step (D-31)', () => {
    const s = service();
    s.setMyPeriodicLimit('u1', okrwToAokrw(450_000n));
    expect(s.getMyPeriodicLimitAokrw('u1')).toBe(okrwToAokrw(450_000n));
    for (const bad of [okrwToAokrw(250_001n), okrwToAokrw(550_000n), okrwToAokrw(25_000n), 0n]) {
      expect(() => {
        s.setMyPeriodicLimit('u1', bad);
      }).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    }
    expect(s.getMyPeriodicLimitAokrw('u1')).toBe(okrwToAokrw(450_000n));
    expect(() => {
      s.setMyPeriodicLimit('nobody', okrwToAokrw(200_000n));
    }).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('clamps an old stored value into the range and onto a step when read (migration 0009)', () => {
    const range = loadConfig({}).policy.myPeriodicLimit;
    expect(clampToRange(range, okrwToAokrw(1_000_000n))).toBe(okrwToAokrw(500_000n));
    expect(clampToRange(range, okrwToAokrw(1n))).toBe(okrwToAokrw(50_000n));
    expect(clampToRange(range, okrwToAokrw(275_000n))).toBe(okrwToAokrw(250_000n));
    expect(clampToRange(range, okrwToAokrw(300_000n))).toBe(okrwToAokrw(300_000n));
  });
});
