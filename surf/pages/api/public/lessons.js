// surf/pages/api/public/lessons.js
import { sql } from '../../../lib/db';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { school, from, to, difficulty } = req.query;
    if (!school) return res.status(400).json({ ok: false, error: 'Missing school' });

    // Resolve school id from slug (or accept direct uuid)
    let schoolId;
    const byId = await sql`SELECT id FROM schools WHERE id = ${school} AND deleted_at IS NULL`;
    if (byId.length) {
      schoolId = byId[0].id;
    } else {
      const bySlug = await sql`SELECT id FROM schools WHERE slug = ${school} AND deleted_at IS NULL`;
      if (!bySlug.length) return res.status(404).json({ ok: false, error: 'School not found' });
      schoolId = bySlug[0].id;
    }

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

    // Build one query using parametrized text
    const text = `
      SELECT
        l.id, l.start_at, l.duration_min, l.place, l.difficulty,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'email', c.email))
            FROM lesson_coaches lc
            JOIN coaches c ON c.id = lc.coach_id
            WHERE lc.lesson_id = l.id
          ), '[]'::json
        ) AS coaches
      FROM lessons l
      ${where}
      ORDER BY l.start_at ASC
      LIMIT 500
    `;
    const rows = await sql(text, params);

    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    console.error('public lessons api error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: cleanErr(err) });
  }
}

function cleanErr(e) {
  return e?.detail || e?.message || String(e);
}
