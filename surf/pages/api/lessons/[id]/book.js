// surf/pages/api/lessons/[id]/book.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const { id } = req.query;
  const method = req.method;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  try {
    if (method === 'POST') {
      const { name, email } = req.body || {};
      if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });

      // Ensure table exists (optional defensive)
      await sql`CREATE TABLE IF NOT EXISTS bookings (
        lesson_id uuid NOT NULL,
        name text,
        email text NOT NULL,
        UNIQUE(lesson_id, email)
      );`;

      // Insert booking (unique by lesson_id + email)
      await sql`INSERT INTO bookings (lesson_id, name, email)
                VALUES (${id}, ${name || null}, ${email})
                ON CONFLICT (lesson_id, email) DO NOTHING;`;

      return res.status(200).json({ ok: true });
    }

    if (method === 'DELETE') {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });

      // Remove booking
      await sql`DELETE FROM bookings WHERE lesson_id = ${id} AND email = ${email};`;

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('book route error:', err);
    // 23505 = unique_violation
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Already booked' });
    }
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
