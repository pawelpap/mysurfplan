// /pages/api/lessons/index.js
import { sql } from '@vercel/postgres';

/**
 * GET /api/lessons?school=<slug>
 * POST /api/lessons  { school: "<slug>", startAt: ISO8601, durationMin: 90, difficulty: "...", place: "...", coachIds?: [uuid, ...] }
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return getLessons(req, res);
  }
  if (req.method === 'POST') {
    return createLesson(req, res);
  }
  res.status(405).json({ ok: false, error: 'Method not allowed' });
}

async function getLessons(req, res) {
  const { school } = req.query;
  if (!school) {
    res.status(400).json({ ok: false, error: 'Missing ?school=<slug>' });
    return;
  }

  try {
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
      WHERE s.slug = ${school} AND l.deleted_at IS NULL
      GROUP BY l.id
      ORDER BY l.start_at ASC;
    `;

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

async function createLesson(req, res) {
  try {
    const { school, startAt, durationMin = 90, difficulty, place, coachIds } = req.body || {};

    if (!school) return res.status(400).json({ ok: false, error: 'Missing body.school (slug)' });
    if (!startAt) return res.status(400).json({ ok: false, error: 'Missing body.startAt (ISO string)' });
    if (!difficulty) return res.status(400).json({ ok: false, error: 'Missing body.difficulty' });
    if (!place) return res.status(400).json({ ok: false, error: 'Missing body.place' });

    // find the school id from slug
    const schoolRow = await sql`SELECT id FROM schools WHERE slug = ${school} AND deleted_at IS NULL LIMIT 1;`;
    if (schoolRow.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'School not found' });
    }
    const schoolId = schoolRow.rows[0].id;

    // insert the lesson
    const inserted = await sql`
      INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
      VALUES (${schoolId}, ${startAt}, ${durationMin}, ${difficulty}, ${place})
      RETURNING id, school_id, start_at, duration_min, difficulty, place;
    `;
    const lesson = inserted.rows[0];

    // link coaches if provided
    if (Array.isArray(coachIds) && coachIds.length) {
      // validate they are UUIDs and belong to the same school (optional but good practice)
      // For now, we just insert blindly—feel free to add validation later.
      for (const coachId of coachIds) {
        await sql`INSERT INTO lesson_coaches (lesson_id, coach_id) VALUES (${lesson.id}, ${coachId}) ON CONFLICT DO NOTHING;`;
      }
    }

    // return camelCased payload
    res.status(201).json({
      ok: true,
      data: {
        id: lesson.id,
        schoolId: lesson.school_id,
        startAt: lesson.start_at,
        durationMin: lesson.duration_min,
        difficulty: lesson.difficulty,
        place: lesson.place,
        coaches: coachIds || []
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Server error', detail: err?.detail || err?.message });
  }
}
