// surf/lib/db.js
import { Pool } from 'pg';

let pool = global.pgPool;
if (!pool) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL, // your Neon URL (already has sslmode=require)
  });
  global.pgPool = pool;
}

export default pool;
