// surf/pages/api/public/lessons.js
import { sql } from '@vercel/postgres';

/**
 * GET /api/public/lessons?school=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=Beginner|Intermediate|Advanced
 *
 * Returns public lessons for a given school (slug), optionally filtered by date range & difficulty.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { school, from, to, difficulty } = req.query;

    if (!school || typeof school !== 'string') {
      return res
        .status(400)
        .json({ ok: false, error: 'Missing or invalid "school" (slug) query param' });
    }

    // Resolve school id from slug
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

    // Build optional filters
    const clauses = [
      sql`l.school_id = ${schoolId}`,
      sql`l.deleted_at IS NULL`,
    ];

    // Dates come as YYYY-MM-DD — convert to UTC bounds
    if (from) {
      const fromUtc = new Date(`${from}T00:00:00Z`);
      if (isNaN(+fromUtc)) {
        return res.status(400).json({ ok: false, error: 'Invalid "from" date' });
      }
      clauses.push(sql`l.start_utc >= ${fromUtc}`);
    }
    if (to) {
      const toUtc = new Date(`${to}T23:59:59Z`);
      if (isNaN(+toUtc)) {
        return res.status(400).json({ ok: false, error: 'Invalid "to" date' });
      }
      clauses.push(sql`l.start_utc <= ${toUtc}`);
    }

    if (difficulty) {
      // Accept exact labels only; DB constraint will also protect
      if (!['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)) {
        return res
          .status(400)
          .json({ ok: false, error: 'Invalid "difficulty" value' });
      }
      clauses.push(sql`l.difficulty = ${difficulty}`);
    }

    // Manually stitch the WHERE clause without using a non-existent sql.join helper
    let where = sql``;
    clauses.forEach((c, i) => {
      where = i === 0 ? sql`${c}` : sql`${where} AND ${c}`;
    });

    const { rows } = await sql`
      SELECT
        l.id,
        l.start_utc,
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
      WHERE ${where}
      GROUP BY l.id
      ORDER BY l.start_utc ASC
      LIMIT 500
    `;

    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    console.error('Public lessons error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      // surface a compact detail during staging to help debugging
      detail: err?.message?.slice(0, 300),
    });
  }
}
