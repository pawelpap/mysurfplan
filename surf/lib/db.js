// surf/lib/db.js
import postgres from 'postgres';

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL;

// IMPORTANT: use the Neon "pooler" connection string in Vercel
// Example looks like:
//   postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/db?sslmode=require
if (!url) {
  throw new Error('DATABASE_URL (or POSTGRES_URL) is not set');
}

// `postgres` works perfectly with Neon on Vercel serverless.
// ssl: 'require' is safe even if already in the URL.
export const sql = postgres(url, {
  ssl: 'require',
  max: 1, // keep serverless connections low
});

// Optional helper for transactions when you need them:
//   await tx(async (t) => { await t`...`; })
export const tx = (fn) => sql.begin(fn);
