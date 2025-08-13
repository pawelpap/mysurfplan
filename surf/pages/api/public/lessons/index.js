// surf/pages/api/public/lessons/index.js
import pool from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { school, from, to, difficulty } = req.query;

    if (!school || !school.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing required parameter: school' });
    }

    // Build the WHERE clause & params incrementally
    const where = [];
    const params = [];
    let i = 1;

    // Scope by school slug
    where.push(`s.slug = $${i++}`);
    params.push(school.trim());

    if (from) {
      // accept YYYY-MM-DD or ISO; Postgres will parse text -> timestamp
      where.push(`l.start_at >= $${i++}`);
      params.push(from);
    }

    if (to) {
      where.push(`l.start_at <= $${i++}`);
      params.push(to);
    }

    if (difficulty) {
      // must match your enum text, e.g. 'Beginner' | 'Intermediate' | 'Advanced'
      where.push(`l.difficulty = $${i++}`);
      params.push(difficulty);
    }

    const sql = `
      SELECT
        l.id,
        l.school_id,
        l.start_at,
        l.duration_min,
        (l.start_at + (l.duration_min || ' minutes')::interval) AS end_at,
        l.difficulty,
        l.place,
        l.capacity,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', c.id, 'name', c.name)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) AS coaches
      FROM lessons l
      JOIN schools s ON s.id = l.school_id
      LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
      LEFT JOIN coaches c ON c.id = lc.coach_id
      WHERE ${where.join(' AND ')}
        AND l.deleted_at IS NULL
      GROUP BY l.id
      ORDER BY l.start_at ASC
    `;

    const { rows } = await pool.query(sql, params);
    return res.status(200).json({ ok: true, lessons: rows });
  } catch (err) {
    console.error('PUBLIC LESSONS API error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: err.message });
  }
}
