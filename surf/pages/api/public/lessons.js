import { sql } from '@vercel/postgres';

/**
 * GET /api/public/lessons
 *   ?school=<slug>            (required)
 *   &from=YYYY-MM-DD          (optional)
 *   &to=YYYY-MM-DD            (optional)
 *   &difficulty=Beginner|Intermediate|Advanced  (optional)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { school, from, to, difficulty } = req.query;

    if (!school || typeof school !== 'string' || !school.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid "school" slug' });
    }

    // 1) Resolve school ID
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

    // 2) Build WHERE fragment incrementally (no sql.join, no nesting)
    let where = sql`l.school_id = ${schoolId} AND l.deleted_at IS NULL`;

    if (from) {
      const fromUtc = new Date(`${from}T00:00:00Z`);
      if (isNaN(+fromUtc)) return res.status(400).json({ ok: false, error: 'Invalid "from" date' });
      where = sql`${where} AND l.start_at >= ${fromUtc}`;
    }

    if (to) {
      const toUtc = new Date(`${to}T23:59:59Z`);
      if (isNaN(+toUtc)) return res.status(400).json({ ok: false, error: 'Invalid "to" date' });
      where = sql`${where} AND l.start_at <= ${toUtc}`;
    }

    if (difficulty) {
      const allowed = ['Beginner', 'Intermediate', 'Advanced'];
      if (!allowed.includes(difficulty)) {
        return res.status(400).json({ ok: false, error: 'Invalid "difficulty" value' });
      }
      // enum compare — cast to text for safety
      where = sql`${where} AND l.difficulty::text = ${difficulty}`;
    }

    // 3) Final query (do NOT wrap it again with sql`${query}`)
    const rowsPromise = sql`
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
      WHERE ${where}
      GROUP BY l.id, l.start_at, l.duration_min, l.difficulty, l.place
      ORDER BY l.start_at ASC
      LIMIT 500
    `;

    const { rows } = await rowsPromise;
    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    console.error('Public lessons error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Server error', detail: String(err.message || err) });
  }
}
