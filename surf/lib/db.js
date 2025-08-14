// surf/lib/db.js
import postgres from 'postgres';

// In Neon, SSL is required. 'require' string works for postgres@3.x
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1, // safe for serverless – Neon multiplexes
});

// Export both default and named so either import style works.
export default sql;
export { sql };
