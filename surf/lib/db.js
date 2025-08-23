// surf/lib/db.js
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Tagged-template executor: sql`SELECT 1`
export const sql = neon(process.env.DATABASE_URL);

// Small helper so we can build dynamic WHEREs safely
export function andWhere(clauses) {
  // clauses is an array of strings that already contain placeholders like ${...}
  // We simply join them with ' AND ' while skipping falsy parts.
  const parts = clauses.filter(Boolean);
  return parts.length ? ' WHERE ' + parts.join(' AND ') : '';
}
