// /pages/api/public/lessons.js
import { sql } from '@vercel/postgres';

/**
 * GET /api/public/lessons?school=<slug>&difficulty=Beginner|Intermediate|Advanced&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { school, difficulty, from, to } = req.query;

  if (!school) {
    res.status(400).json({ ok: false, error: 'Missing ?school=<slug>' });
    return;
  }

  try {
    // Build WHERE conditions incrementally
    let where = sql`s.slug = ${school} AND l.deleted_at IS NULL`;
    if (difficulty) {
      where = sql`${where} AND l.difficulty = ${difficulty}`;
    }
    if (from) {
      // inclusive from date
      where = sql`${where} AND l.start_at >= ${from}`;
    }
    if (to) {
      // inclusive to date end-of-day
      where = sql`${where} AND l.start_at <= (${to}::date + interval '1 day' - interval '1 second')`;
    }

    const { rows } = await sql`
      SELECT
        l.id,
        l.school_id,
        l.start_at,
        l.duration_min,
        l.difficulty,
        l.place,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', c.id, 'name', c.name)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) AS coaches
      FROM lessons l
      JOIN schools s ON s.id = l.school_id
      LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
      LEFT JOIN coaches c ON c.id = lc.coach_id
      WHERE ${where}
      GROUP BY l.id
      ORDER BY l.start_at ASC
      LIMIT 200;
    `;

    // camelCase response
    const data = rows.map(r => ({
      id: r.id,
      schoolId: r.school_id,
      startAt: r.start_at,
      durationMin: r.duration_min,
      difficulty: r.difficulty,
      place: r.place,
      coaches: r.coaches || []
    }));

    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Server error', detail: err?.detail || err?.message });
  }
}
