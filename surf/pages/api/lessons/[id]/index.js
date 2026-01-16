// surf/pages/api/lessons/[id]/index.js
import { sql } from 'lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  try {
    if (req.method === 'DELETE') {
      const rows = await sql`
        UPDATE lessons
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id;
      `;
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Lesson not found' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    console.error('lessons delete error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
