// surf/pages/api/public/lessons.js
import { sql } from '../../../lib/db';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const school = Array.isArray(req.query.school) ? req.query.school[0] : req.query.school;
    const { from, to, difficulty } = req.query;
    if (!school) return res.status(400).json({ ok: false, error: 'Missing school' });

    const byId = await sql`SELECT id FROM schools WHERE id = ${school} AND deleted_at IS NULL`;
    const bySlug = byId.length
      ? []
      : await sql`SELECT id FROM schools WHERE slug = ${school} AND deleted_at IS NULL`;
    const schoolId = byId[0]?.id || bySlug[0]?.id;
    if (!schoolId) return res.status(404).json({ ok: false, error: 'School not found' });

    const params = [];
    let where = `WHERE l.school_id = $1 AND l.deleted_at IS NULL`;
    params.push(schoolId);

    if (from) {
      params.push(from);
      where += ` AND l.start_at >= $${params.length}`;
    }
    if (to) {
      params.push(to + 'T23:59:59');
      where += ` AND l.start_at <= $${params.length}`;
    }
    if (difficulty) {
      params.push(difficulty);
      where += ` AND l.difficulty = $${params.length}`;
    }

    const text = `
      SELECT
        l.id,
        l.start_at,
        l.duration_min,
        l.place,
        l.difficulty,
        l.capacity,
        COALESCE(lc.coaches, '[]'::json) AS coaches,
        COALESCE(ls.booked_count, 0) AS booked_count,
        COALESCE(ls.spots_left, 0) AS spots_left
      FROM lessons l
      LEFT JOIN lesson_coach_list lc ON lc.lesson_id = l.id
      LEFT JOIN lesson_stats ls ON ls.lesson_id = l.id
      ${where}
      ORDER BY l.start_at ASC
      LIMIT 500
    `;
    const rows = await sql(text, params);

    const data = rows.map((r) => ({
      id: r.id,
      startAt: r.start_at,
      durationMin: r.duration_min,
      place: r.place,
      difficulty: r.difficulty,
      capacity: r.capacity,
      coaches: r.coaches || [],
      bookedCount: r.booked_count,
      spotsLeft: r.spots_left,
    }));

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('public lessons api error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: cleanErr(err) });
  }
}

function cleanErr(e) {
  return e?.detail || e?.message || String(e);
}
