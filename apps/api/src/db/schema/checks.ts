import { sql } from 'drizzle-orm';
import { check, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * aokrw decimal integer text only: digits, no leading zero, at most 78 digits
 * (uint256), the same rule as menus.price (data.md). SQLite-only GLOB; drop it
 * when moving to Postgres numeric(78,0).
 */
export function aokrwCheck(name: string, column: SQLiteColumn) {
  return check(
    name,
    // verify-allow: R4 drizzle sql template with a column reference, not a display string
    sql`${column} <> '' and ${column} not glob '*[^0-9]*' and (${column} = '0' or ${column} not like '0%') and length(${column}) <= 78`,
  );
}

/**
 * CHECK that a text column is one of the given values. Values are code
 * constants inlined into the DDL (a migration cannot hold bind parameters),
 * so only plain identifiers are accepted.
 */
export function enumCheck(name: string, column: SQLiteColumn, values: readonly string[]) {
  assertSafeName(name);
  if (values.length === 0) throw new Error(`enumCheck: ${name} has no values`);
  for (const v of values) {
    if (!/^[A-Za-z0-9_]+$/.test(v)) throw new Error(`enumCheck: unsafe value ${v}`);
  }
  return check(name, sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`);
}

/** CHECK that an integer column is one of the given values (agent levels). */
export function intEnumCheck(name: string, column: SQLiteColumn, values: readonly number[]) {
  assertSafeName(name);
  if (values.length === 0) throw new Error(`intEnumCheck: ${name} has no values`);
  for (const v of values) {
    if (!Number.isSafeInteger(v)) throw new Error(`intEnumCheck: unsafe value ${String(v)}`);
  }
  return check(name, sql`${column} in (${sql.raw(values.join(', '))})`);
}

function assertSafeName(name: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`check: unsafe constraint name ${name}`);
}
