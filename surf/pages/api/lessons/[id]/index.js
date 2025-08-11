// surf/pages/api/lessons/[id]/index.js
import { sql } from '@vercel/postgres';

async function ensureTables() {
  await sql`CREATE TABLE IF NOT EXISTS lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    start_iso timestamptz NOT NULL,
    duration_min integer NOT NULL DEFAULT 90,
    difficulty text NOT NULL,
    place text NOT NULL
  );`;

  // bookings exists so ON DELETE CASCADE can work if you add FK later
  await sql`CREATE TABLE IF NOT EXISTS bookings (
    lesson_id uuid NOT NULL,
    name text,
    email text NOT NULL,
    UNIQUE(lesson_id, email)
  );`;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const method = req.method;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  try {
    if (method === 'DELETE') {
      await ensureTables();

      // Delete lesson; if you later add FK with ON DELETE CASCADE, this will also remove bookings
      await sql`DELETE FROM lessons WHERE id = ${id};`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('lesson [id] error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
