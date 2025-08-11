// surf/pages/api/lessons/[id]/index.js
import { sql } from '@vercel/postgres';

async function ensureBookings() {
  await sql`CREATE TABLE IF NOT EXISTS bookings (
    lesson_id text NOT NULL,
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
      // Remove related bookings first (compare via lessons.id::text)
      await ensureBookings();
      await sql`DELETE FROM bookings WHERE lesson_id = ${id};`;
      await sql`DELETE FROM lessons WHERE id::text = ${id};`;

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('lesson [id] delete error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
