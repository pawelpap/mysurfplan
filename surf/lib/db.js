// surf/lib/db.js
import { neon, neonConfig } from '@neondatabase/serverless';

/**
 * Use one fetch connection per serverless instance (Vercel/Edge-safe).
 * See: https://github.com/neondatabase/serverless#caching-connections
 */
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL');
}

/**
 * `sql` is a function you can call in two ways:
 * 1) Tagged template  ->  await sql`SELECT 1`;
 * 2) Text + params    ->  await sql('SELECT * FROM t WHERE id=$1', [id]);
 */
export const sql = neon(process.env.DATABASE_URL);

/** Small helper to run a tx: await tx(async (q) => { await q`...`; }) */
export async function tx(run) {
  return sql.begin(run);
}
