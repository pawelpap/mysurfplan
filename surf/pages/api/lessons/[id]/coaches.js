import { isUuid } from '../../../../lib/school-access.mjs';
import { requireMutation } from '../../../../lib/request-security.mjs';
// surf/pages/api/lessons/[id]/coaches.js
import { sql } from "lib/db";
import { requireAuth } from "../../../../lib/auth";

export default async function handler(req, res) {
  if (!requireMutation(req, res)) return;
  const { id } = req.query;
  if (!isUuid(id)) {
    return res.status(400).json({ ok: false, error: "Invalid lesson id" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    if (!(await requireAuth(req, res, { roles: ["school_admin"] }))) return;
    const { coachIds } = req.body || {};
    if (!Array.isArray(coachIds) || coachIds.some(id => !isUuid(id))) {
      return res
        .status(400)
        .json({ ok: false, error: "Choose valid instructors from this school" });
    }

    const lessonRows = await sql`
      SELECT id, school_id
      FROM lessons
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `;
    const lesson = lessonRows[0];
    if (!lesson)
      return res.status(404).json({ ok: false, error: "Lesson not found" });
    if (
      !(await requireAuth(req, res, {
        roles: ["admin", "school_admin"],
        schoolId: lesson.school_id,
      }))
    )
      return;

    const uniqIds = [...new Set(coachIds.filter(Boolean))];
    if (uniqIds.length) {
      const validCoaches = await sql`
        SELECT id
        FROM coaches
        WHERE school_id = ${lesson.school_id}
          AND id = ANY(${uniqIds})
          AND deleted_at IS NULL
      `;
      if (validCoaches.length !== uniqIds.length) {
        return res
          .status(400)
          .json({ ok: false, error: "Invalid coach for this school" });
      }
    }

    await sql.transaction([
      sql`DELETE FROM lesson_coaches WHERE lesson_id = ${id}`,
      ...uniqIds.map(
        (coachId) => sql`
        INSERT INTO lesson_coaches (lesson_id, coach_id)
        VALUES (${id}, ${coachId}) ON CONFLICT DO NOTHING
      `,
      ),
    ]);

    return res
      .status(200)
      .json({ ok: true, data: { lessonId: id, coachIds: uniqIds } });
  } catch (err) {
    console.error("lesson coaches update error:", err);
    return res
      .status(500)
      .json({
        ok: false,
        error: "Server error",
      });
  }
}
