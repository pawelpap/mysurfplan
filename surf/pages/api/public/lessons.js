// surf/pages/api/public/lessons.js
import sql from '../../../lib/db';

function bad(res, msg) {
  return res.status(400).json({ ok: false, error: msg });
}
function fail(res, e, status = 500) {
  const detail = e?.detail || e?.message || 'Server error';
  return res.status(status).json({ ok: false, error: 'Server error', detail });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { school, from, to, difficulty } = req.query || {};
      if (!school) return bad(res, 'Missing query.school (slug)');

      const where = [sql`l.school_id = s.id`, sql`s.slug = ${school}`];
      if (from) where.push(sql`l.start_at >= ${new Date(from)}`);
      if (to) where.push(sql`l.start_at <= ${new Date(to + 'T23:59:59')}`);
      if (difficulty && difficulty !== 'All') {
        where.push(sql`l.difficulty = ${difficulty}`);
      }

      const rows = await sql`
        SELECT
          l.id,
          l.start_at,
          l.duration_min,
          l.difficulty,
          l.place,
          l.capacity,
          COALESCE(json_agg(
            DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)
          ) FILTER (WHERE c.id IS NOT NULL), '[]') AS coaches
        FROM lessons l
        JOIN schools s ON s.id = l.school_id
        LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
        LEFT JOIN coaches c ON c.id = lc.coach_id
        WHERE ${sql.where(where)}
        GROUP BY l.id
        ORDER BY l.start_at ASC
      `;

      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { schoolSlug, startAt, durationMin, difficulty, place, coachIds } =
        req.body || {};

      if (!schoolSlug) return bad(res, 'Missing body.schoolSlug (school slug).');
      if (!startAt) return bad(res, 'Missing body.startAt (ISO string).');

      const [school] = await sql`
        SELECT id FROM schools WHERE slug = ${schoolSlug} AND deleted_at IS NULL
      `;
      if (!school) return fail(res, { message: 'School not found' }, 404);

      // Create lesson
      const [lesson] = await sql`
        INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
        VALUES (
          ${school.id},
          ${new Date(startAt)},
          ${durationMin ?? 90},
          ${difficulty || 'Beginner'},
          ${place || null}
        )
        RETURNING id, start_at, duration_min, difficulty, place
      `;

      // Optional coach links
      const list = Array.isArray(coachIds)
        ? coachIds
            .map((x) => String(x).trim())
            .filter(Boolean)
        : String(coachIds || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

      if (list.length) {
        await Promise.all(
          list.map((coachId) =>
            sql`
              INSERT INTO lesson_coaches (lesson_id, coach_id)
              VALUES (${lesson.id}, ${coachId}::uuid)
              ON CONFLICT DO NOTHING
            `
          )
        );
      }

      return res.status(201).json({ ok: true, data: lesson });
    }

    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    return fail(res, e);
  }
}
