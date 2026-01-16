// /pages/api/lessons/index.js
import { sql } from 'lib/db';

/**
 * GET /api/lessons?school=<slug|id>
 * POST /api/lessons  { school: "<slug|id>", startAt: ISO8601, durationMin: 90, difficulty: "...", place: "...", coachIds?: [uuid, ...] }
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function resolveSchoolId(school) {
  if (isUuid(school)) {
    const byId = await sql`SELECT id FROM schools WHERE id = ${school} AND deleted_at IS NULL`;
    if (byId.length) return byId[0].id;
  }
  const bySlug = await sql`SELECT id FROM schools WHERE slug = ${school} AND deleted_at IS NULL`;
  return bySlug[0]?.id || null;
}

async function getLessons(req, res) {
  const school = Array.isArray(req.query.school) ? req.query.school[0] : req.query.school;
  if (!school) {
    res.status(400).json({ ok: false, error: 'Missing ?school=<slug>' });
    return;
  }

  try {
    const schoolId = await resolveSchoolId(school);
    if (!schoolId) return res.status(404).json({ ok: false, error: 'School not found' });

    const rows = await sql`
      SELECT
        l.id,
        l.school_id,
        l.start_at,
        l.duration_min,
        l.difficulty,
        l.place,
        l.capacity,
        COALESCE(lc.coaches, '[]'::json) AS coaches,
        COALESCE(ls.booked_count, 0) AS booked_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', s.id, 'name', s.name, 'email', s.email)
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS attendees
      FROM lessons l
      LEFT JOIN lesson_coach_list lc ON lc.lesson_id = l.id
      LEFT JOIN lesson_stats ls ON ls.lesson_id = l.id
      LEFT JOIN bookings b ON b.lesson_id = l.id AND b.status = 'booked'
      LEFT JOIN students s ON s.id = b.student_id
      WHERE l.school_id = ${schoolId} AND l.deleted_at IS NULL
      GROUP BY l.id, lc.coaches, ls.booked_count
      ORDER BY l.start_at ASC;
    `;

    const data = rows.map((r) => ({
      id: r.id,
      schoolId: r.school_id,
      startAt: r.start_at,
      durationMin: r.duration_min,
      difficulty: r.difficulty,
      place: r.place,
      capacity: r.capacity,
      bookedCount: r.booked_count,
      coaches: r.coaches || [],
      attendees: r.attendees || [],
    }));

    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Server error', detail: err?.detail || err?.message });
  }
}

async function createLesson(req, res) {
  try {
    const {
      school,
      startAt,
      startISO,
      durationMin = 90,
      difficulty,
      place,
      coachIds,
    } = req.body || {};

    const startValue = startAt || startISO;

    if (!school) return res.status(400).json({ ok: false, error: 'Missing body.school (slug)' });
    if (!startValue) return res.status(400).json({ ok: false, error: 'Missing body.startAt (ISO string)' });
    if (!difficulty) return res.status(400).json({ ok: false, error: 'Missing body.difficulty' });
    if (!place) return res.status(400).json({ ok: false, error: 'Missing body.place' });

    const schoolId = await resolveSchoolId(school);
    if (!schoolId) {
      return res.status(404).json({ ok: false, error: 'School not found' });
    }

    const inserted = await sql`
      INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
      VALUES (${schoolId}, ${startValue}, ${durationMin}, ${difficulty}, ${place})
      RETURNING id, school_id, start_at, duration_min, difficulty, place, capacity;
    `;
    const lesson = inserted[0];

    if (Array.isArray(coachIds) && coachIds.length) {
      for (const coachId of coachIds) {
        await sql`INSERT INTO lesson_coaches (lesson_id, coach_id) VALUES (${lesson.id}, ${coachId}) ON CONFLICT DO NOTHING;`;
      }
    }

    res.status(201).json({
      ok: true,
      data: {
        id: lesson.id,
        schoolId: lesson.school_id,
        startAt: lesson.start_at,
        durationMin: lesson.duration_min,
        difficulty: lesson.difficulty,
        place: lesson.place,
        capacity: lesson.capacity,
        coaches: coachIds || [],
        attendees: [],
        bookedCount: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Server error', detail: err?.detail || err?.message });
  }
}
