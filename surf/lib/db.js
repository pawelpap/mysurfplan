// surf/lib/db.js
import { Pool } from "pg";

// Neon/Vercel can expose any of these; prefer POSTGRES_URL if present.
const CONN =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

if (!CONN) {
  // Keeping a clear error helps when ENV isn't wired yet
  throw new Error("Missing DB connection string (POSTGRES_URL / POSTGRES_PRISMA_URL / DATABASE_URL).");
}

// Reuse a single pool across hot reloads
let pool = global._mywaveplan_pool;
if (!pool) {
  pool = new Pool({
    connectionString: CONN,
    max: 5,
    ssl: { rejectUnauthorized: false }, // Neon requires TLS; this works with Vercel/Neon
  });
  global._mywaveplan_pool = pool;
}

// Simple tagged-template sugar: q`SELECT ... ${val}`
export async function q(strings, ...values) {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
  return pool.query(text, values);
}

export default pool;
