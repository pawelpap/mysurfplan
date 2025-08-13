// surf/pages/api/public/lessons.js
import { sql } from '@vercel/postgres';

/**
 * GET /api/public/lessons
 *   ?school=<slug>            (required)
 *   &from=YYYY-MM-DD          (optional)
 *   &to=YYYY-MM-DD            (optional)
 *   &difficulty=Beginner|Intermediate|Advanced  (optional)
 *
 * Schema (as in your Neon screenshot):
 *   lessons (
 *     id uuid pk,
 *     school_id uuid fk -> schools.id,
 *     start_at timestamptz not null,
 *     duration_min integer not null default 90,
 *     difficulty difficulty_level not null default 'Beginner',
 *     place text,
 *     deleted_at timestamptz null
 *     ...
 *   )
 *   lesson_coaches (lesson_id uuid, coach_id uuid)
 *   coaches (id uuid, name text, deleted_at timestamptz null)
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
    const schoolResult = await sql`
      SELECT id
      FROM schools
      WHERE slug = ${school} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (schoolResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'School not found' });
    }
    const schoolId = schoolResult.rows[0].id;

    // 2) Build filters safely
    const conds = [
      sql`l.school_id = ${schoolId}`,
      sql`l.deleted_at IS NULL`,
    ];

    if (from) {
      // From 00:00:00Z of that day
      const fromUtc = new Date(`${from}T00:00:00Z`);
      if (isNaN(+fromUtc)) {
        return res.status(400).json({ ok: false, error: 'Invalid "from" date' });
      }
      conds.push(sql`l.start_at >= ${fromUtc}`);
    }

    if (to) {
      // Until 23:59:59Z of that day
      const toUtc = new Date(`${to}T23:59:59Z`);
      if (isNaN(+toUtc)) {
        return res.status(400).json({ ok: false, error: 'Invalid "to" date' });
      }
      conds.push(sql`l.start_at <= ${toUtc}`);
    }

    if (difficulty) {
      const allowed = ['Beginner', 'Intermediate', 'Advanced'];
      if (!allowed.includes(difficulty)) {
        return res.status(400).json({ ok: false, error: 'Invalid "difficulty" value' });
      }
      // enum compare (cast to text reliably)
      conds.push(sql`l.difficulty::text = ${difficulty}`);
    }

    const whereClause = sql.join(conds, sql` AND `);

    // 3) Single, final query
    const query = sql`
      SELECT
        l.id,
        l.start_at,
        l.duration_min,
        l.difficulty::text AS difficulty, -- return as text for the API
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
      WHERE ${whereClause}
      GROUP BY l.id, l.start_at, l.duration_min, l.difficulty, l.place
      ORDER BY l.start_at ASC
      LIMIT 500
    `;

    const { rows } = await sql`${query}`;
    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    console.error('Public lessons error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Server error', detail: String(err.message || err).slice(0, 400) });
  }
}
