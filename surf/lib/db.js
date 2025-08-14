// surf/lib/db.js
import postgres from 'postgres';

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL (or POSTGRES_URL) is not set');
}

// Works with Neon pooled URL on Vercel (serverless).
export const sql = postgres(url, {
  ssl: 'require',
  max: 1,
});

// Optional transactional helper
export const tx = (fn) => sql.begin(fn);
