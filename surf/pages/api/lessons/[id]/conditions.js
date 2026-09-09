import { sql } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";
import { isUuid } from "../../../../lib/lesson-input.mjs";
import { getConditions } from "../../../../lib/conditions/service";
import { lessonWindow } from "../../../../lib/conditions/model.mjs";
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!isUuid(req.query.id))
    return res.status(400).json({ ok: false, error: "Invalid lesson." });
  const identity = await requireAuth(req, res);
  if (!identity) return;
  try {
    const [lesson] =
      await sql`SELECT id,school_id,spot_id,start_at,duration_min FROM lessons WHERE id=${req.query.id} AND deleted_at IS NULL`;
    if (!lesson)
      return res.status(404).json({ ok: false, error: "Lesson not found." });
    const [own] =
      await sql`SELECT 1 FROM bookings b JOIN students s ON s.id=b.student_id WHERE b.lesson_id=${lesson.id} AND b.status='booked' AND s.school_id=${lesson.school_id} AND s.user_id=${identity.userId}::uuid AND s.deleted_at IS NULL LIMIT 1`;
    if (!own) {
      const session = await requireAuth(req, res, {
        schoolId: lesson.school_id,
      });
      if (!session) return;
      if (session.role === "coach") {
        const assigned =
          await sql`SELECT 1 FROM lesson_coaches lc JOIN coaches c ON c.id=lc.coach_id WHERE lc.lesson_id=${lesson.id} AND c.school_id=${lesson.school_id} AND c.user_id=${session.userId} AND c.deleted_at IS NULL`;
        if (!assigned.length)
          return res
            .status(403)
            .json({ ok: false, error: "This lesson is not assigned to you." });
      }
    }
    if (!lesson.spot_id)
      return res.json({
        ok: true,
        data: {
          unavailable:
            "Choose a database spot in Edit lesson to see conditions and allow bookings.",
        },
      });
    const data = await getConditions(lesson.spot_id, req.query.refresh === "1");
    if (!data)
      return res.json({
        ok: true,
        data: { unavailable: "This lesson’s spot is unavailable." },
      });
    const window = lessonWindow(
      data,
      lesson.start_at,
      lesson.duration_min,
      data.spot.calibration,
    );
    return res.json({
      ok: true,
      data: {
        ...data,
        hours: undefined,
        tides: undefined,
        extremes: undefined,
        dates: undefined,
        window,
      },
    });
  } catch (e) {
    console.error("lesson conditions API", e.message);
    return res.status(503).json({
      ok: false,
      error: "Lesson conditions are temporarily unavailable.",
    });
  }
}
