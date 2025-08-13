// Central DB client (Neon)
// Uses POSTGRES_URL (preferred) or DATABASE_URL as a fallback.
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing POSTGRES_URL or DATABASE_URL environment variable.');
}

export const sql = neon(connectionString);

// Optional: quick connectivity probe
export async function dbPing() {
  const rows = await sql`SELECT 1 AS ok`;
  return rows?.[0]?.ok === 1;
}
