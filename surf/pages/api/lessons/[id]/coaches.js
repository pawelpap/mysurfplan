import { isUuid } from '../../../../lib/school-access.mjs';
import { requireMutation } from '../../../../lib/request-security.mjs';
// surf/pages/api/lessons/[id]/coaches.js
import { sql } from "lib/db";
import { requireAuth } from "../../../../lib/auth";
import { schoolLessonError } from "../../../../lib/school-lesson-errors.mjs";

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
    const session=await requireAuth(req,res,{roles:["admin","school_admin"],schoolId:lesson.school_id});
    if(!session)return;
    const uniqIds = [...new Set(coachIds.filter(Boolean))];
    await sql`SELECT set_school_lesson_coaches(${session.userId}::uuid,${lesson.school_id}::uuid,${id}::uuid,${uniqIds}::uuid[])`;

    return res
      .status(200)
      .json({ ok: true, data: { lessonId: id, coachIds: uniqIds } });
  } catch (error) {
    const problem=schoolLessonError(error);
    return res.status(problem.status).json({ok:false,error:problem.message});
  }
}
