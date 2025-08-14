// surf/lib/db.js
import { neon } from "@neondatabase/serverless";

// Neon query function bound to the DATABASE_URL
export const db = neon(process.env.DATABASE_URL);

/**
 * Simple helper for parameterized SQL.
 * Usage: await q("select * from table where id = $1", [id])
 */
export function q(text, params = []) {
  return db(text, params);
}
