import { isUuid, schoolAccess } from "../../../../lib/school-access.mjs";
import { requireMutation } from "../../../../lib/request-security.mjs";
// surf/pages/api/lessons/[id]/book.js
import { sql } from "lib/db";
import { normalizeEmail, requireAuth } from "../../../../lib/auth";

async function getLesson(id) {
  const rows = await sql`
    SELECT id, school_id, start_at, spot_id, EXISTS(SELECT 1 FROM surf_spots sp WHERE sp.id=lessons.spot_id AND sp.active=true) AS spot_active
    FROM lessons
    WHERE id = ${id} AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

function normalizeName(name) {
  return typeof name === "string" ? name.trim() : "";
}

async function coachIsAssigned(lessonId, schoolId, userId) {
  if (!userId) return false;
  const rows = await sql`
    SELECT 1
    FROM lesson_coaches lc
    JOIN coaches c ON c.id = lc.coach_id
    WHERE lc.lesson_id = ${lessonId}
      AND c.school_id = ${schoolId}
      AND c.user_id = ${userId}
      AND c.deleted_at IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}

export default async function handler(req, res) {
  if (!requireMutation(req, res)) return;
  const { id } = req.query;
  if (!isUuid(id)) {
    return res.status(400).json({ ok: false, error: "Invalid lesson id" });
  }

  try {
    const identity = await requireAuth(req, res);
    if (!identity) return;
    const lesson = await getLesson(id);
    if (!lesson)
      return res.status(404).json({ ok: false, error: "Lesson not found" });

    if (req.method === "POST") {
      if (!lesson.spot_id || !lesson.spot_active)
        return res.status(409).json({
          ok: false,
          error:
            "A school admin must choose an active database spot before this lesson can be booked.",
        });
      if (new Date(lesson.start_at).getTime() <= Date.now())
        return res
          .status(409)
          .json({ ok: false, error: "This lesson has already started." });
      const { name, email, onBehalf = false } = req.body || {};
      const normalizedEmail = onBehalf ? normalizeEmail(email) : identity.email;
      const normalizedName = normalizeName(name);
      if (!normalizedEmail)
        return res.status(400).json({ ok: false, error: "Missing email" });
      if (typeof onBehalf !== "boolean")
        return res
          .status(400)
          .json({ ok: false, error: "Invalid booking mode" });
      if (!onBehalf && email && normalizeEmail(email) !== identity.email)
        return res
          .status(403)
          .json({ ok: false, error: "Use your own account to book." });
      const access = schoolAccess(identity, lesson.school_id);
      const assigned =
        access.teach &&
        (await coachIsAssigned(id, lesson.school_id, identity.userId));
      if (onBehalf && !access.manageSchool && !assigned)
        return res.status(403).json({ ok: false, error: "Forbidden" });
      if (
        (req.method === "POST" || onBehalf) &&
        !(await requireAuth(req, res, { schoolId: lesson.school_id }))
      )
        return;
      const session = identity;

      const [result] =
        await sql`SELECT * FROM reserve_lesson(${session.userId}::uuid,${id}::uuid,${onBehalf},${normalizedName},${normalizedEmail})`;
      if (!result) {
        return res
          .status(409)
          .json({
            ok: false,
            error: "Could not book this lesson. Please contact the school.",
          });
      }

      if (result.outcome === "full") {
        return res.status(409).json({ ok: false, error: "Lesson is full" });
      }

      return res.status(200).json({
        ok: true,
        data: {
          studentId: result.student_id,
          email: result.email,
          status: result.outcome,
        },
      });
    }

    if (req.method === "DELETE") {
      const { email, onBehalf = false } = req.body || {};
      const normalizedEmail = onBehalf ? normalizeEmail(email) : identity.email;
      if (!normalizedEmail)
        return res.status(400).json({ ok: false, error: "Missing email" });
      if (typeof onBehalf !== "boolean")
        return res
          .status(400)
          .json({ ok: false, error: "Invalid booking mode" });
      if (!onBehalf && email && normalizeEmail(email) !== identity.email)
        return res
          .status(403)
          .json({ ok: false, error: "Use your own account to book." });
      const access = schoolAccess(identity, lesson.school_id);
      const assigned =
        access.teach &&
        (await coachIsAssigned(id, lesson.school_id, identity.userId));
      if (onBehalf && !access.manageSchool && !assigned)
        return res.status(403).json({ ok: false, error: "Forbidden" });
      if (
        (req.method === "POST" || onBehalf) &&
        !(await requireAuth(req, res, { schoolId: lesson.school_id }))
      )
        return;
      const session = identity;

      const students = await sql`
        SELECT id
        FROM students
        WHERE school_id = ${lesson.school_id} AND deleted_at IS NULL
          AND (CASE WHEN ${onBehalf} THEN email = ${normalizedEmail} ELSE user_id = ${session.userId}::uuid END)
        LIMIT 1
      `;
      const student = students[0];
      if (!student)
        return res.status(404).json({ ok: false, error: "Not booked" });

      const cancelled = await sql`
        UPDATE bookings
        SET status = 'cancelled', cancelled_at = now(), updated_at = now()
        WHERE lesson_id = ${id} AND student_id = ${student.id} AND status = 'booked'
        RETURNING id;
      `;
      if (!cancelled.length) {
        return res.status(404).json({ ok: false, error: "Not booked" });
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["POST", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    if (e?.code === "P0003")
      return res.status(409).json({ ok: false, error: "Lesson is full" });
    if (["23505", "23514"].includes(e?.code))
      return res
        .status(409)
        .json({
          ok: false,
          error:
            "This booking needs the school’s help. No existing record has been claimed or changed.",
        });
    if (e?.code === "42501")
      return res.status(403).json({ ok: false, error: "Forbidden" });
    console.error("bookings error:", { code: e?.code });
    return res
      .status(500)
      .json({
        ok: false,
        error: "Could not update the booking. Please try again.",
      });
  }
}
