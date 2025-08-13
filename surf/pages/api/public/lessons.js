// surf/pages/api/public/lessons.js
import { sql } from '@vercel/postgres';

/**
 * GET /api/public/lessons?school=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=Beginner|Intermediate|Advanced
 * Matches schema:
 *   - lessons.start_at (timestamptz)
 *   - lessons.duration_min (integer)
 *   - lessons.difficulty (enum difficulty_level)
 *   - lessons.place (text)
 *   - lessons.school_id (uuid)
 *   - lessons.deleted_at (timestamptz, nullable)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { school, from, to, difficulty } = req.query;
    if (!school || typeof school !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing or invalid "school" slug' });
    }

    // 1) Resolve school id
    const schoolRow = await sql`
      SELECT id FROM schools
      WHERE slug = ${school} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (schoolRow.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'School not found' });
    }
    const schoolId = schoolRow.rows[0].id;

    // 2) Validate & normalize filters
    let fromUtc = null, toUtc = null;
    if (from) {
      fromUtc = new Date(`${from}T00:00:00Z`);
      if (isNaN(+fromUtc)) return res.status(400).json({ ok: false, error: 'Invalid "from" date' });
    }
    if (to) {
      toUtc = new Date(`${to}T23:59:59Z`);
      if (isNaN(+toUtc)) return res.status(400).json({ ok: false, error: 'Invalid "to" date' });
    }
    if (difficulty && !['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)) {
      return res.status(400).json({ ok: false, error: 'Invalid "difficulty" value' });
    }

    // 3) Base query – no empty boolean fragments
    let q = sql`
      SELECT
        l.id,
        l.start_at AS start_ts,
        l.duration_min,
        l.difficulty,
        l.place,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', c.id, 'name', c.name)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS coaches
      FROM lessons l
      LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
      LEFT JOIN coaches c ON c.id = lc.coach_id AND c.deleted_at IS NULL
      WHERE l.school_id = ${schoolId}
        AND l.deleted_at IS NULL
    `;

    if (fromUtc) q = sql`${q} AND l.start_at >= ${fromUtc}`;
    if (toUtc)   q = sql`${q} AND l.start_at <= ${toUtc}`;

    // enum-safe compare (cast enum to text then compare)
    if (difficulty) q = sql`${q} AND l.difficulty::text = ${difficulty}`;

    q = sql`${q}
      GROUP BY l.id, l.start_at
      ORDER BY l.start_at ASC
      LIMIT 500
    `;

    const { rows } = await sql`${q}`;
    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    console.error('Public lessons error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: err?.message?.slice(0, 300) });
  }
}
