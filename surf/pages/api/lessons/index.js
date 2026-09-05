// /pages/api/lessons/index.js
import { sql } from "lib/db";
import { getAuthSession, requireAuth } from "../../../lib/auth";
import { validateLesson } from "../../../lib/lesson-input.mjs";

/**
 * GET /api/lessons?school=<slug|id>
 * POST /api/lessons  { school: "<slug|id>", startAt: ISO8601, durationMin: 90, difficulty: "...", place: "...", coachIds?: [uuid, ...] }
 */
export default async function handler(req, res) {
  if (req.method === "GET") {
    return getLessons(req, res);
  }
  if (req.method === "POST") {
    return createLesson(req, res);
  }
  res.status(405).json({ ok: false, error: "Method not allowed" });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function resolveSchoolId(school) {
  if (isUuid(school)) {
    const byId =
      await sql`SELECT id FROM schools WHERE id = ${school} AND deleted_at IS NULL`;
    if (byId.length) return byId[0].id;
  }
  const bySlug =
    await sql`SELECT id FROM schools WHERE slug = ${school} AND deleted_at IS NULL`;
  return bySlug[0]?.id || null;
}

async function getLessons(req, res) {
  const school = Array.isArray(req.query.school)
    ? req.query.school[0]
    : req.query.school;
  if (!school) {
    res.status(400).json({ ok: false, error: "Missing ?school=<slug>" });
    return;
  }

  try {
    const schoolId = await resolveSchoolId(school);
    if (!schoolId)
      return res.status(404).json({ ok: false, error: "School not found" });
    if (
      !requireAuth(req, res, {
        roles: ["admin", "school_admin", "coach", "student"],
        schoolId,
      })
    )
      return;
    const session = getAuthSession(req);

    let rows = await sql`
      SELECT
        l.id,
        l.school_id,
        l.start_at,
        l.duration_min,
        l.difficulty,
        l.place,
        l.spot_id,
        sp.name AS spot_name,
        sp.timezone AS spot_timezone,
        sp.active AS spot_active,
        l.capacity,
        COALESCE(
          (SELECT lc.coaches FROM lesson_coach_list lc WHERE lc.lesson_id = l.id),
          '[]'::json
        ) AS coaches,
        COALESCE(
          (SELECT ls.booked_count FROM lesson_stats ls WHERE ls.lesson_id = l.id),
          0
        ) AS booked_count,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT('id', s.id, 'name', s.name, 'email', s.email)
            )
            FROM bookings b
            JOIN students s ON s.id = b.student_id
            WHERE b.lesson_id = l.id AND b.status = 'booked'
          ),
          '[]'::json
        ) AS attendees
      FROM lessons l
      LEFT JOIN surf_spots sp ON sp.id = l.spot_id
      WHERE l.school_id = ${schoolId} AND l.deleted_at IS NULL
      ORDER BY l.start_at ASC;
    `;

    if (session?.role === "coach") {
      const assigned = await sql`
        SELECT lc.lesson_id
        FROM lesson_coaches lc
        JOIN coaches c ON c.id = lc.coach_id
        WHERE c.school_id = ${schoolId}
          AND c.user_id = ${session.userId}
          AND c.deleted_at IS NULL
      `;
      const assignedLessonIds = new Set(assigned.map((row) => row.lesson_id));
      rows = rows.filter((row) => assignedLessonIds.has(row.id));
    }

    const data = rows.map((r) => ({
      id: r.id,
      schoolId: r.school_id,
      startAt: r.start_at,
      durationMin: r.duration_min,
      difficulty: r.difficulty,
      place: r.place,
      spotId: r.spot_id,
      spotName: r.spot_name,
      spotTimezone: r.spot_timezone,
      spotActive: Boolean(r.spot_active),
      capacity: r.capacity,
      bookedCount: r.booked_count,
      coaches: r.coaches || [],
      attendees:
        session?.role === "student"
          ? (r.attendees || []).filter(
              (p) => p.email?.toLowerCase() === session.email?.toLowerCase(),
            )
          : r.attendees || [],
    }));

    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Server error",
      detail: err?.detail || err?.message,
    });
  }
}

async function createLesson(req, res) {
  try {
    const { school } = req.body || {};
    if (typeof school !== "string" || !school)
      return res.status(400).json({ ok: false, error: "Choose a school." });
    const schoolId = await resolveSchoolId(school);
    if (!schoolId)
      return res.status(404).json({ ok: false, error: "School not found" });
    if (!requireAuth(req, res, { roles: ["admin", "school_admin"], schoolId }))
      return;
    let input;
    try {
      input = validateLesson(req.body);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    const {
      startAt,
      durationMin,
      difficulty,
      place,
      capacity,
      coachIds,
      spotId,
    } = input;
    const [spot] =
      await sql`SELECT id FROM surf_spots WHERE id=${spotId} AND active=true`;
    if (!spot)
      return res
        .status(400)
        .json({
          ok: false,
          error: "Choose an active surf spot from the list.",
        });
    if (coachIds.length) {
      const valid =
        await sql`SELECT id FROM coaches WHERE school_id = ${schoolId} AND id = ANY(${coachIds}::uuid[]) AND deleted_at IS NULL`;
      if (valid.length !== coachIds.length)
        return res
          .status(400)
          .json({ ok: false, error: "Choose instructors from this school." });
    }
    const rows = await sql`
      WITH created AS (
        INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place, capacity, spot_id)
        VALUES (${schoolId}, ${startAt}, ${durationMin}, ${difficulty}, ${place}, ${capacity}, ${spotId})
        RETURNING *
      ), assigned AS (
        INSERT INTO lesson_coaches (lesson_id, coach_id)
        SELECT l.id, c.id FROM created l JOIN coaches c ON c.id = ANY(${coachIds}::uuid[]) AND c.school_id = l.school_id AND c.deleted_at IS NULL
        RETURNING id
      )
      SELECT id, school_id, start_at, duration_min, difficulty, place, capacity, spot_id FROM created
    `;
    const row = rows[0];
    return res.status(201).json({
      ok: true,
      data: {
        id: row.id,
        schoolId: row.school_id,
        startAt: row.start_at,
        durationMin: row.duration_min,
        difficulty: row.difficulty,
        place: row.place,
        spotId: row.spot_id,
        capacity: row.capacity,
        bookedCount: 0,
        attendees: [],
        coaches: [],
      },
    });
  } catch (error) {
    console.error("lesson creation failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Could not create the lesson. Please try again.",
    });
  }
}
