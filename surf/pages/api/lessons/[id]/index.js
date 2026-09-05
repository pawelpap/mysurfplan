import { sql } from "lib/db";
import { requireAuth } from "../../../../lib/auth";
import { isUuid, validateLesson } from "../../../../lib/lesson-input.mjs";

export default async function handler(req, res) {
  const { id } = req.query;
  if (!isUuid(id))
    return res.status(400).json({ ok: false, error: "Invalid lesson id" });
  if (!["PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const [lesson] =
      await sql`SELECT id, school_id FROM lessons WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
    if (!lesson)
      return res.status(404).json({ ok: false, error: "Lesson not found" });
    if (
      !requireAuth(req, res, {
        roles: ["admin", "school_admin"],
        schoolId: lesson.school_id,
      })
    )
      return;
    if (req.method === "DELETE") {
      await sql`UPDATE lessons SET deleted_at = now(), updated_at = now() WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }
    let input;
    try {
      input = validateLesson(req.body);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    const { startAt, durationMin, difficulty, place, capacity } = input;
    const rows = await sql`
      UPDATE lessons SET start_at = ${startAt}, duration_min = ${durationMin}, difficulty = ${difficulty}, place = ${place}, capacity = ${capacity}, updated_at = now()
      WHERE id = ${id} AND deleted_at IS NULL
        AND (${capacity}::integer IS NULL OR ${capacity}::integer >= (SELECT count(*) FROM bookings WHERE lesson_id = ${id} AND status = 'booked'))
      RETURNING id, start_at, duration_min, difficulty, place, capacity
    `;
    if (!rows.length)
      return res
        .status(409)
        .json({
          ok: false,
          error:
            "Capacity cannot be lower than the number of current bookings.",
        });
    const row = rows[0];
    return res
      .status(200)
      .json({
        ok: true,
        data: {
          id: row.id,
          startAt: row.start_at,
          durationMin: row.duration_min,
          difficulty: row.difficulty,
          place: row.place,
          capacity: row.capacity,
        },
      });
  } catch (error) {
    console.error("lesson update failed:", error);
    return res
      .status(500)
      .json({
        ok: false,
        error: "Could not update the lesson. Please try again.",
      });
  }
}
