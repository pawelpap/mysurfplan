// surf/lib/db.js
import { Pool } from "pg";

// Reuse a single Pool across lambda invocations
const pool =
  global._neonPool ||
  new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL,
    ssl: { rejectUnauthorized: false },
  });

if (!global._neonPool) global._neonPool = pool;

export default pool;
