// Public liveness check; never return connection or environment details.
import { sql } from 'lib/db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const rows = await sql`SELECT 1 AS ok`;
    const dbOk = rows?.[0]?.ok === 1;

    res.status(200).json({
      ok: true,
      db: dbOk,

    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Service temporarily unavailable' });
  }
}
