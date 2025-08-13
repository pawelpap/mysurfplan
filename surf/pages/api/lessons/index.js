// surf/pages/api/lessons/index.js
import { sql } from '@vercel/postgres';

// ---------- helpers ----------
function bad(res, msg = 'Bad request', code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}
function ok(res, data) {
  return res.status(200).json({ ok: true, data });
}

async function resolveSchoolId({ school_id, school }) {
  if (school_id) return school_id;
  if (!school) return null;
  const { rows } = await sql`
    SELECT id FROM schools
    WHERE (id::text = ${school} OR slug = ${school}) AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    const m = req.method;

    // GET /api/lessons?school=<slug|uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=Beginner
    if (m === 'GET') {
      const { school_id, school, from, to, difficulty } = req.query;
      const sid = await resolveSchoolId({ school_id, school });
      if (!sid) return ok(res, []); // scoped listing; empty if school missing

      // date filters
      const fromISO = from ? new Date(from).toISOString() : null;
      const toISO = to ? new Date(to + 'T23:59:59').toISOString() : null;

      // main query with coach names + booked count
      const { rows } = await sql`
        SELECT
          l.id,
          l.school_id,
          l.start_iso,
          l.duration_min,
          l.difficulty,
          l.place,
          COALESCE(
            ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL),
            '{}'
          ) AS coaches,
          (
            SELECT COUNT(*)
            FROM bookings b
            WHERE b.lesson_id = l.id AND b.canceled_at IS NULL
          ) AS booked
        FROM lessons l
        LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
        LEFT JOIN coaches c ON c.id = lc.coach_id AND c.deleted_at IS NULL
        WHERE l.deleted_at IS NULL
          AND l.school_id = ${sid}
          ${fromISO ? sql`AND l.start_iso >= ${fromISO}` : sql``}
          ${toISO ? sql`AND l.start_iso <= ${toISO}` : sql``}
          ${difficulty ? sql`AND l.difficulty = ${difficulty}` : sql``}
        GROUP BY l.id
        ORDER BY l.start_iso ASC
      `;
      // shape to the FE structure you’ve used before
      const data = rows.map(r => ({
        id: r.id,
        startISO: r.start_iso,
        durationMin: r.duration_min,
        difficulty: r.difficulty,
        place: r.place,
        attendees: Array.from({ length: Number(r.booked || 0) }, () => ({})), // just count compatibility
        coaches: r.coaches, // array of names
      }));
      return ok(res, data);
    }

    // POST /api/lessons
    // body: { school:<slug|uuid> or school_id, startISO, durationMin, difficulty, place, coachIds?: uuid[] }
    if (m === 'POST') {
      const { school_id, school, startISO, durationMin, difficulty, place, coachIds } = req.body || {};
      if (!startISO || !difficulty || !place) return bad(res, 'startISO, difficulty and place are required');

      const sid = await resolveSchoolId({ school_id, school });
      if (!sid) return bad(res, 'school or school_id is required');

      const dur = Number(durationMin || 90);

      const { rows } = await sql`
        INSERT INTO lessons (school_id, start_iso, duration_min, difficulty, place)
        VALUES (${sid}, ${new Date(startISO).toISOString()}, ${dur}, ${difficulty}, ${place})
        RETURNING id, school_id, start_iso, duration_min, difficulty, place, created_at
      `;
      const lesson = rows[0];

      // link coaches if provided
      if (Array.isArray(coachIds) && coachIds.length > 0) {
        const values = coachIds.map((cid) => sql`(${lesson.id}, ${cid})`);
        await sql`
          INSERT INTO lesson_coaches (lesson_id, coach_id)
          VALUES ${sql.join(values, sql`, `)}
          ON CONFLICT DO NOTHING
        `;
      }

      return ok(res, {
        id: lesson.id,
        startISO: lesson.start_iso,
        durationMin: lesson.duration_min,
        difficulty: lesson.difficulty,
        place: lesson.place,
        attendees: [],
        coaches: coachIds || [],
      });
    }

    // PATCH /api/lessons
    // body: { id, startISO?, durationMin?, difficulty?, place?, coachIds? (replace set) }
    if (m === 'PATCH') {
      const { id, startISO, durationMin, difficulty, place, coachIds } = req.body || {};
      if (!id) return bad(res, 'id is required');

      // update lesson core fields
      const { rows } = await sql`
        UPDATE lessons SET
          start_iso = COALESCE(${startISO ? new Date(startISO).toISOString() : null}, start_iso),
          duration_min = COALESCE(${durationMin ?? null}, duration_min),
          difficulty = COALESCE(${difficulty ?? null}, difficulty),
          place = COALESCE(${place ?? null}, place)
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id
      `;
      if (rows.length === 0) return bad(res, 'not found', 404);

      // replace coach set if provided
      if (Array.isArray(coachIds)) {
        await sql`DELETE FROM lesson_coaches WHERE lesson_id = ${id}`;
        if (coachIds.length > 0) {
          const values = coachIds.map((cid) => sql`(${id}, ${cid})`);
          await sql`
            INSERT INTO lesson_coaches (lesson_id, coach_id)
            VALUES ${sql.join(values, sql`, `)}
            ON CONFLICT DO NOTHING
          `;
        }
      }
      return ok(res, true);
    }

    // DELETE /api/lessons?id=<uuid>
    if (m === 'DELETE') {
      const { id } = req.query;
      if (!id) return bad(res, 'id is required');
      const { rows } = await sql`
        UPDATE lessons
        SET deleted_at = NOW()
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id
      `;
      if (rows.length === 0) return bad(res, 'not found', 404);
      return ok(res, true);
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return bad(res, 'Method not allowed', 405);
  } catch (err) {
    console.error('Lessons API error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
