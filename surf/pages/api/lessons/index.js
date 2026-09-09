import { requireMutation } from "../../../lib/request-security.mjs";
// /pages/api/lessons/index.js
import { sql } from "lib/db";
import { requireAuth } from "../../../lib/auth";
import { validateLesson } from "../../../lib/lesson-input.mjs";

/**
 * GET /api/lessons?school=<slug|id>
 * POST /api/lessons  { school: "<slug|id>", startAt: ISO8601, durationMin: 90, difficulty: "...", place: "...", coachIds?: [uuid, ...] }
 */
export default async function handler(req, res) {
  if (!requireMutation(req, res)) return;
  if (
    !(await requireAuth(req, res, {
      roles:
        req.method === "GET"
          ? ["school_admin", "coach", "student"]
          : ["school_admin"],
    }))
  )
    return;
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
  try {
    const personal = req.query.scope === "bookings";
    const teaching = req.query.scope === "teaching";
    if (req.query.scope && !personal && !teaching)
      return res.status(400).json({ ok: false, error: "Invalid lesson view" });
    let schoolId = null;
    if (!personal && !teaching) {
      if (typeof req.query.school !== "string")
        return res.status(400).json({ ok: false, error: "Choose a school." });
      schoolId = await resolveSchoolId(req.query.school);
      if (!schoolId)
        return res.status(404).json({ ok: false, error: "School not found" });
    }
    const session = await requireAuth(req, res, schoolId ? { schoolId } : {});
    if (!session) return;
    const rows = await sql`
      SELECT l.id,l.school_id,sc.name AS school_name,l.start_at,l.duration_min,l.difficulty,l.place,l.spot_id,l.capacity,
       sp.name AS spot_name,sp.timezone AS spot_timezone,sp.active AS spot_active,
       sc.deleted_at IS NULL AND sc.workspace_status NOT IN ('closed','suspended') AS school_open,
       access.manage,access.teach,access.mine,
       COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name)) FROM lesson_coaches lc JOIN coaches c ON c.id=lc.coach_id
         WHERE lc.lesson_id=l.id AND c.school_id=l.school_id AND c.deleted_at IS NULL),'[]'::json) AS coaches,
       (SELECT count(*)::int FROM bookings b WHERE b.lesson_id=l.id AND b.status='booked') AS booked_count,
       COALESCE((SELECT json_agg(json_build_object('id',s.id,'name',s.name,'email',s.email)) FROM bookings b JOIN students s ON s.id=b.student_id
         WHERE b.lesson_id=l.id AND b.status='booked' AND s.school_id=l.school_id AND s.deleted_at IS NULL
          AND ((NOT ${personal} AND (access.manage OR access.teach)) OR s.user_id=${session.userId}::uuid)),'[]'::json) AS attendees
      FROM lessons l JOIN schools sc ON sc.id=l.school_id LEFT JOIN surf_spots sp ON sp.id=l.spot_id
      CROSS JOIN LATERAL (SELECT account_manages_school(${session.userId}::uuid,l.school_id) AS manage,
       EXISTS(SELECT 1 FROM account_school_access a JOIN coaches c ON c.school_id=a.school_id AND c.user_id=a.user_id
        JOIN lesson_coaches lc ON lc.coach_id=c.id WHERE a.user_id=${session.userId}::uuid AND a.school_id=l.school_id
        AND a.school_open AND a.status='active' AND 'coach'=ANY(a.roles) AND c.deleted_at IS NULL AND lc.lesson_id=l.id) AS teach,
       EXISTS(SELECT 1 FROM bookings b JOIN students s ON s.id=b.student_id WHERE b.lesson_id=l.id AND b.status='booked'
        AND s.user_id=${session.userId}::uuid AND s.school_id=l.school_id AND s.deleted_at IS NULL) AS mine) access
      WHERE l.deleted_at IS NULL AND
       CASE WHEN ${personal} THEN access.mine WHEN ${teaching} THEN access.teach
       ELSE l.school_id=${schoolId}::uuid AND sc.deleted_at IS NULL AND sc.workspace_status NOT IN ('closed','suspended')
        AND (${session.role !== "coach"} OR access.teach) END
      ORDER BY l.start_at ASC LIMIT 500`;
    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        schoolId: r.school_id,
        schoolName: r.school_name,
        startAt: r.start_at,
        durationMin: r.duration_min,
        difficulty: r.difficulty,
        place: r.place,
        spotId: r.spot_id,
        spotName: r.spot_name,
        spotTimezone: r.spot_timezone,
        spotActive: Boolean(r.spot_active),
        schoolOpen: r.school_open,
        capacity: r.capacity,
        bookedCount: r.booked_count,
        isMine: r.mine,
        coaches: r.coaches,
        attendees: r.attendees,
        capabilities: {
          manageSchool: !personal && r.manage,
          manageBookings: !personal && (r.manage || r.teach),
          bookSelf: r.school_open,
          cancelSelf: r.mine,
        },
      })),
    });
  } catch {
    return res
      .status(500)
      .json({ ok: false, error: "Could not load lessons. Please try again." });
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
    if (
      !(await requireAuth(req, res, {
        roles: ["admin", "school_admin"],
        schoolId,
      }))
    )
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
      return res.status(400).json({
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
