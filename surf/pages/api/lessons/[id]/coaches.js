// surf/pages/api/lessons/[id]/coaches.js
import { sql } from 'lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing lesson id' });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { coachIds } = req.body || {};
    if (!Array.isArray(coachIds)) {
      return res.status(400).json({ ok: false, error: 'coachIds must be an array' });
    }

    const lessonRows = await sql`
      SELECT id, school_id
      FROM lessons
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `;
    const lesson = lessonRows[0];
    if (!lesson) return res.status(404).json({ ok: false, error: 'Lesson not found' });

    const uniqIds = [...new Set(coachIds.filter(Boolean))];
    if (uniqIds.length) {
      const validCoaches = await sql`
        SELECT id
        FROM coaches
        WHERE school_id = ${lesson.school_id}
          AND id = ANY(${uniqIds})
          AND deleted_at IS NULL
      `;
      if (validCoaches.length !== uniqIds.length) {
        return res.status(400).json({ ok: false, error: 'Invalid coach for this school' });
      }
    }

    await sql`DELETE FROM lesson_coaches WHERE lesson_id = ${id};`;
    for (const coachId of uniqIds) {
      await sql`
        INSERT INTO lesson_coaches (lesson_id, coach_id)
        VALUES (${id}, ${coachId})
        ON CONFLICT DO NOTHING;
      `;
    }

    return res.status(200).json({ ok: true, data: { lessonId: id, coachIds: uniqIds } });
  } catch (err) {
    console.error('lesson coaches update error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: err?.detail || err?.message });
  }
}
