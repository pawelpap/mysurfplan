import { requireMutation } from '../../../../lib/request-security.mjs';
import { sql } from "lib/db";
import { requireAuth } from "../../../../lib/auth";
import { isUuid, validateLesson } from "../../../../lib/lesson-input.mjs";
import { schoolLessonError } from "../../../../lib/school-lesson-errors.mjs";

export default async function handler(req, res) {
  if (!requireMutation(req, res)) return;
  const { id } = req.query;
  if (!isUuid(id))
    return res.status(400).json({ ok: false, error: "Invalid lesson id" });
  if (!["PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    if (!(await requireAuth(req, res, { roles: ["school_admin"] }))) return;
    const [lesson] =
      await sql`SELECT id, school_id FROM lessons WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
    if (!lesson)
      return res.status(404).json({ ok: false, error: "Lesson not found" });
    const session = await requireAuth(req,res,{roles:["admin","school_admin"],schoolId:lesson.school_id});
    if (!session) return;
    if(req.method==='DELETE') {
      await sql`SELECT mutate_school_lesson(${session.userId}::uuid,${lesson.school_id}::uuid,'delete',${id}::uuid,NULL)`;
      return res.status(200).json({ok:true});
    }
    let input;
    try {
      input = validateLesson(req.body);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    const [result]=await sql`SELECT mutate_school_lesson(${session.userId}::uuid,${lesson.school_id}::uuid,'update',${id}::uuid,${JSON.stringify(input)}::jsonb) AS data`;
    return res.status(200).json({ok:true,data:result.data});
  } catch (error) {
    const problem=schoolLessonError(error);
    return res.status(problem.status).json({ok:false,error:problem.message});
  }
}
