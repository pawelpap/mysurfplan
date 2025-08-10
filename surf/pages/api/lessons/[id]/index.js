// surf/pages/api/lessons/[id]/index.js
import { sql } from '@vercel/postgres';

/**
 * Robust delete handler:
 * - Safely deletes from possible booking tables first (if they exist)
 * - Then deletes the lesson row
 * - Returns helpful errors instead of a generic 500
 */
export default async function handler(req, res) {
  const { id } = req.query;
  const method = req.method;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  try {
    if (method === 'DELETE') {
      await sql.begin(async (tx) => {
        // Detect which (if any) booking tables exist in this DB.
        const { rows } = await tx`
          SELECT 
            to_regclass('public.bookings') as bookings,
            to_regclass('public.attendees') as attendees,
            to_regclass('public.lesson_bookings') as lesson_bookings
        `;
        const exists = rows?.[0] || {};

        // Delete any dependent rows first (no-op if table doesn't exist)
        if (exists.bookings)        await tx`DELETE FROM bookings WHERE lesson_id = ${id};`;
        if (exists.attendees)       await tx`DELETE FROM attendees WHERE lesson_id = ${id};`;
        if (exists.lesson_bookings) await tx`DELETE FROM lesson_bookings WHERE lesson_id = ${id};`;

        // Now delete the lesson itself
        const { rowCount } = await tx`DELETE FROM lessons WHERE id = ${id};`;
        if (rowCount === 0) {
          // Throw to rollback the transaction and return a nice 404
          const err = new Error('NOT_FOUND');
          err.code = 'NOT_FOUND';
          throw err;
        }
      });

      return res.status(200).json({ ok: true });
    }

    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM lessons WHERE id = ${id};`;
      if (!rows[0]) return res.status(404).json({ ok: false, error: 'Lesson not found' });
      return res.status(200).json({ ok: true, data: rows[0] });
    }

    res.setHeader('Allow', ['DELETE', 'GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    // Normalise errors so the UI can show a useful message.
    if (err?.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, error: 'Lesson not found' });
    }
    if (err?.code === '23503') { // foreign_key_violation
      return res.status(409).json({ ok: false, error: 'Cannot delete: lesson has related bookings' });
    }
    console.error('DELETE /api/lessons/:id error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
