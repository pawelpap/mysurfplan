// Simple health check: verifies DB connectivity and shows a couple env flags
import { sql } from 'lib/db';

export default async function handler(req, res) {
  try {
    const rows = await sql`SELECT 1 AS ok`;
    const dbOk = rows?.[0]?.ok === 1;

    res.status(200).json({
      ok: true,
      db: dbOk,
      env: {
        hasPostgresUrl: Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL),
        nodeEnv: process.env.NODE_ENV || null,
        vercelEnv: process.env.VERCEL_ENV || null,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
