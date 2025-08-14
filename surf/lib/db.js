// surf/lib/db.js
import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL');
}

export const sql = neon(process.env.DATABASE_URL);

// transaction helper
export async function tx(run) {
  return sql.begin(run);
}
