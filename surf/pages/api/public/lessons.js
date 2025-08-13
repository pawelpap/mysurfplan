// surf/pages/api/public/lessons.js
import { sql } from '@vercel/postgres';

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { school, from, to, difficulty } = req.query;

    // --- 1) Validate incoming params
    if (!school || typeof school !== 'string' || !school.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid "school" slug' });
    }

    let fromUtc = null;
    if (from) {
      fromUtc = new Date(`${from}T00:00:00Z`);
      if (isNaN(+fromUtc)) {
        return res.status(400).json({ ok: false, error: 'Invalid "from" date' });
      }
    }

    let toUtc = null;
    if (to) {
      toUtc = new Date(`${to}T23:59:59Z`);
      if (isNaN(+toUtc)) {
        return res.status(400).json({ ok: false, error: 'Invalid "to" date' });
      }
    }

    let diff = null;
    if (difficulty) {
      if (!DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({ ok: false, error: 'Invalid "difficulty" value' });
      }
      diff = difficulty;
    }

    // --- 2) Resolve school -> id (ensures we never pass "{}")
    const schoolRow = await sql`
      SELECT id
      FROM schools
      WHERE slug = ${school} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (schoolRow.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'School not found' });
    }
    const schoolId = schoolRow.rows[0].id;

    // --- 3) Query lessons with inline conditional fragments
    const result = await sql`
      SELECT
        l.id,
        l.start_at,
        l.duration_min,
        l.difficulty::text AS difficulty,
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
        ${fromUtc ? sql` AND l.start_at >= ${fromUtc}` : sql``}
        ${toUtc   ? sql` AND l.start_at <= ${toUtc}`   : sql``}
        ${diff    ? sql` AND l.difficulty::text = ${diff}` : sql``}
      GROUP BY l.id
      ORDER BY l.start_at ASC
      LIMIT 500
    `;

    return res.status(200).json({ ok: true, data: result.rows });
  } catch (err) {
    console.error('Public lessons error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      detail: String(err.message || err),
    });
  }
}
