import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { users } from '../../db/schema/index.js';

/** Queries on users only (architecture.md: repositories hold no rules). */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  findMonthlyBudget(userId: string): string | undefined {
    return this.handle.db
      .select({ monthlyBudgetAokrw: users.monthlyBudgetAokrw })
      .from(users)
      .where(eq(users.id, userId))
      .get()?.monthlyBudgetAokrw;
  }

  findProfile(userId: string): { nickname: string; monthlyBudgetAokrw: string } | undefined {
    return this.handle.db
      .select({ nickname: users.nickname, monthlyBudgetAokrw: users.monthlyBudgetAokrw })
      .from(users)
      .where(eq(users.id, userId))
      .get();
  }

  setMonthlyBudget(userId: string, aokrw: string): void {
    this.handle.db
      .update(users)
      .set({ monthlyBudgetAokrw: aokrw })
      .where(eq(users.id, userId))
      .run();
  }

  /** Default address text and its neighborhood; undefined when the user does not exist. */
  findAddress(userId: string): { text: string | null; dong: string | null } | undefined {
    const row = this.handle.db
      .select({ text: users.addressText, dong: users.addressDong })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    return row;
  }

  /** undefined: no such user; null: the user has not set an address yet. */
  findAddressDong(userId: string): string | null | undefined {
    const row = this.handle.db
      .select({ addressDong: users.addressDong })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    return row === undefined ? undefined : row.addressDong;
  }
}
