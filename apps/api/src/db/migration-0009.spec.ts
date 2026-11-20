import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';
import * as schema from './schema/index.js';

// Migration 0009 (D-31): agents.level becomes the per-order amount, users.monthly_budget becomes
// the 30-day limit with its value kept, agent_limit_history drops level. Amounts by hand:
// N won = N followed by 18 zeros.
const dir = resolve(__dirname, 'migrations');
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
const W = (won: string) => `${won}000000000000000000`;

function apply(db: Database.Database, from: string, upTo: string) {
  for (const f of files) {
    if (f < from || f > upTo) continue;
    for (const stmt of readFileSync(resolve(dir, f), 'utf8').split('--> statement-breakpoint')) {
      if (stmt.trim() !== '') db.exec(stmt);
    }
  }
}

function before0009(): Database.Database {
  const db = new Database(':memory:');
  apply(db, '0000', '0008_zzz');
  db.exec(
    `INSERT INTO users (id, nickname, monthly_budget, created_at) VALUES ('u1','a','${W('200000')}',1),('u2','b','${W('1000000')}',1),('u3','c','${W('300000')}',1)`,
  );
  db.exec(
    "INSERT INTO agents (id, user_id, dragon_name, dragon_species, status, payment_path, wallet_address, level, setup_step, created_at) VALUES ('a1','u1','용이','forest','ACTIVE','B','0xabc',1,'done',5),('a2','u2','봄봄','star','FROZEN','B','0xdef',2,'done',6),('a3','u3','별이','water','ACTIVE','mock','0x123',3,'done',7)",
  );
  db.exec(
    `INSERT INTO agent_limit_history (id, agent_id, level, transfer_limit, created_at) VALUES ('l1','a3',3,'${W('50000')}',8)`,
  );
  return db;
}

describe('migration 0009_limit_amounts (D-31)', () => {
  it('maps level 1, 2, 3 to 10,000, 30,000, 50,000 and keeps the 30-day value as it was', () => {
    const db = before0009();
    apply(db, '0009', '0009_zzz');
    expect(
      db
        .prepare('SELECT id, status, wallet_address, per_order_limit FROM agents ORDER BY id')
        .all(),
    ).toEqual([
      { id: 'a1', status: 'ACTIVE', wallet_address: '0xabc', per_order_limit: W('10000') },
      { id: 'a2', status: 'FROZEN', wallet_address: '0xdef', per_order_limit: W('30000') },
      { id: 'a3', status: 'ACTIVE', wallet_address: '0x123', per_order_limit: W('50000') },
    ]);
    // Kept as stored, even 1,000,000 (over the cap): UsersService clamps it on read.
    expect(db.prepare('SELECT id, my_periodic_limit FROM users ORDER BY id').all()).toEqual([
      { id: 'u1', my_periodic_limit: W('200000') },
      { id: 'u2', my_periodic_limit: W('1000000') },
      { id: 'u3', my_periodic_limit: W('300000') },
    ]);
    expect(db.prepare('SELECT id, transfer_limit FROM agent_limit_history').all()).toEqual([
      { id: 'l1', transfer_limit: W('50000') },
    ]);
    const cols = (t: string) =>
      (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(cols('agents')).not.toContain('level');
    expect(cols('agent_limit_history')).not.toContain('level');
    expect(cols('users')).not.toContain('monthly_budget');
    // The new amount columns carry the aokrw CHECK; one dragon per user still holds.
    expect(() => db.exec("UPDATE agents SET per_order_limit = '1.5' WHERE id = 'a1'")).toThrow(
      /CHECK/,
    );
    expect(() => db.exec("UPDATE users SET my_periodic_limit = '-1' WHERE id = 'u1'")).toThrow(
      /CHECK/,
    );
    expect(() =>
      db.exec(
        `INSERT INTO agents (id, user_id, dragon_name, dragon_species, payment_path, per_order_limit, created_at) VALUES ('a4','u1','x','star','mock','${W('10000')}',1)`,
      ),
    ).toThrow(/UNIQUE/);
    db.close();
  });

  it('runs through runMigrations on a database with foreign keys on and rows pointing at agents and users', () => {
    const sqlite = before0009();
    sqlite.exec(
      `INSERT INTO merchants (id, name, category, payout_address, metadata_uri, source, created_at) VALUES ('m1','국밥','한식','0x1','https://x.test','seed',1)`,
    );
    sqlite.exec(
      `INSERT INTO orders (id, order_ref, user_id, agent_id, merchant_id, amount, items_json, status, created_at, updated_at) VALUES ('o1','0x${'1'.repeat(64)}','u1','a1','m1','${W('9000')}','[]','paid',1,1)`,
    );
    sqlite.exec(
      "INSERT INTO sessions (id, user_id, platform, expires_at) VALUES ('s1','u1','web',1)",
    );
    // Record 0000..0008 as applied, the way the drizzle migrator does, so only 0009 runs.
    const journal = JSON.parse(readFileSync(resolve(dir, 'meta/_journal.json'), 'utf8')) as {
      entries: { tag: string; when: number }[];
    };
    sqlite.exec(
      'CREATE TABLE "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
    );
    for (const e of journal.entries.filter((x) => x.tag < '0009')) {
      sqlite
        .prepare('INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)')
        .run(e.tag, e.when);
    }
    sqlite.pragma('foreign_keys = ON');
    runMigrations(drizzle(sqlite, { schema }));
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(sqlite.prepare('SELECT agent_id, user_id FROM orders').all()).toEqual([
      { agent_id: 'a1', user_id: 'u1' },
    ]);
    sqlite.close();
  });
});
