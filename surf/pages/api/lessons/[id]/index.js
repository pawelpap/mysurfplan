// surf/pages/api/lessons/[id]/index.js
import sql from '../../../lib/db';

async function ensureTables() {
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS surf_lessons (
      id        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      start_iso timestamptz NOT NULL,
      duration_min integer NOT NULL DEFAULT 90,
      difficulty text NOT NULL,
      place      text NOT NULL
    );
  `;
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS surf_bookings (
      lesson_id text NOT NULL,
      name      text,
      email     text NOT NULL,
      UNIQUE (lesson_id, email)
    );
  `;
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  try {
    await ensureTables();

    if (req.method === 'DELETE') {
      await sql/*sql*/`DELETE FROM surf_bookings WHERE lesson_id = ${id};`;
      await sql/*sql*/`DELETE FROM surf_lessons  WHERE id = ${id};`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    console.error('surf_lessons delete error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
