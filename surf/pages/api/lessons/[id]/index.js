// surf/pages/api/lessons/[id]/index.js
import { sql } from '@vercel/postgres';

/**
 * DELETE /api/lessons/:id
 * - Runs a manual transaction (BEGIN/COMMIT).
 * - Tries to delete from likely child tables first. If a table doesn't exist,
 *   we ignore that specific error (code 42P01).
 * - Deletes the lesson row; returns 404 if not found.
 */
export default async function handler(req, res) {
  const { id } = req.query;
  const method = req.method;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  if (method === 'GET') {
    try {
      const { rows } = await sql`SELECT * FROM lessons WHERE id = ${id};`;
      if (!rows[0]) return res.status(404).json({ ok: false, error: 'Lesson not found' });
      return res.status(200).json({ ok: true, data: rows[0] });
    } catch (err) {
      console.error('GET /lessons/:id error', err);
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
  }

  if (method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE', 'GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  try {
    // Start transaction
    await sql`BEGIN`;

    // Try to delete from possible child tables first (ignore "relation does not exist" 42P01)
    const tryDelete = async (query) => {
      try { await query; }
      catch (e) { if (e?.code !== '42P01') throw e; /* ignore missing table */ }
    };

    await tryDelete(sql`DELETE FROM bookings WHERE lesson_id = ${id};`);
    await tryDelete(sql`DELETE FROM attendees WHERE lesson_id = ${id};`);
    await tryDelete(sql`DELETE FROM lesson_bookings WHERE lesson_id = ${id};`);

    // Now delete the lesson itself
    const { rowCount } = await sql`DELETE FROM lessons WHERE id = ${id};`;

    if (rowCount === 0) {
      await sql`ROLLBACK`;
      return res.status(404).json({ ok: false, error: 'Lesson not found' });
    }

    await sql`COMMIT`;
    return res.status(200).json({ ok: true });
  } catch (err) {
    try { await sql`ROLLBACK`; } catch {}
    // FK violation code is 23503; report clearly
    if (err?.code === '23503') {
      return res.status(409).json({ ok: false, error: 'Cannot delete: lesson has related bookings' });
    }
    console.error('DELETE /lessons/:id error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}