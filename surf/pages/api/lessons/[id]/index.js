// surf/pages/api/lessons/[id]/index.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing lesson id' });
  }

  try {
    if (method === 'DELETE') {
      // If you have a bookings table, delete those rows first to satisfy FK constraints.
      // If you DON'T have a bookings table yet, remove the next line safely.
      await sql`DELETE FROM bookings WHERE lesson_id = ${id};`;

      const result = await sql`DELETE FROM lessons WHERE id = ${id};`;
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      return res.status(200).json({ ok: true });
    }

    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM lessons WHERE id = ${id};`;
      if (!rows[0]) return res.status(404).json({ error: 'Lesson not found' });
      return res.status(200).json(rows[0]);
    }

    res.setHeader('Allow', ['DELETE', 'GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('Lesson [id] API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
