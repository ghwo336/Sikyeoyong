import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

// Migration 0003 rebuilds agents (new setup_step, mock path). Rows that existed before must keep
// their data, and setup_step must follow their status, since the old table had no such column.
const dir = resolve(__dirname, 'migrations');
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

function apply(db: Database.Database, from: string, upTo: string) {
  for (const f of files) {
    if (f < from || f > upTo) continue;
    for (const stmt of readFileSync(resolve(dir, f), 'utf8').split('--> statement-breakpoint')) {
      if (stmt.trim() !== '') db.exec(stmt);
    }
  }
}

describe('migration 0003_agent_setup', () => {
  it('keeps existing agents and sets setup_step from their status', () => {
    const db = new Database(':memory:');
    apply(db, '0000', '0002_zzz');
    db.exec(
      "INSERT INTO users (id, nickname, monthly_budget, created_at) VALUES ('u1','a','1',1),('u2','b','1',1)",
    );
    db.exec(
      "INSERT INTO agents (id, user_id, dragon_name, dragon_species, status, payment_path, wallet_address, level, created_at) VALUES ('a1','u1','용이','forest','ACTIVE','B','0xabc',2,5),('a2','u2','봄봄','star','PENDING','B',NULL,1,6)",
    );
    apply(db, '0003', '0003_zzz');
    const rows = db
      .prepare(
        'SELECT id, status, wallet_address, level, setup_step, payment_path FROM agents ORDER BY id',
      )
      .all();
    expect(rows).toEqual([
      {
        id: 'a1',
        status: 'ACTIVE',
        wallet_address: '0xabc',
        level: 2,
        setup_step: 'done',
        payment_path: 'B',
      },
      {
        id: 'a2',
        status: 'PENDING',
        wallet_address: null,
        level: 1,
        setup_step: 'wallet',
        payment_path: 'B',
      },
    ]);
    expect(() =>
      db.exec(
        "INSERT INTO agents (id, user_id, dragon_name, dragon_species, payment_path, created_at) VALUES ('a3','u2','x','star','mock',1)",
      ),
    ).toThrow(/UNIQUE/); // still one dragon per user
    db.close();
  });
});
