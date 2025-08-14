// surf/pages/api/public/lessons.js
import { sql } from "../../../lib/db";

/**
 * Public lessons API (school-scoped)
 *
 * GET  /api/public/lessons?school=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=Beginner|Intermediate|Advanced|All
 * POST /api/public/lessons?school=<slug>
 *      { startAt: ISO string, durationMin: number, difficulty: string, place: string, coachIds?: string[] }
 */
export default async function handler(req, res) {
  const json = (status, data) => res.status(status).json(data);

  try {
    const { school: schoolSlug } = req.query || {};
    if (!schoolSlug || typeof schoolSlug !== "string") {
      return json(400, { ok: false, error: "Missing query.school (school slug)" });
    }

    // Resolve school once
    const schoolRow = await sql/*sql*/`
      SELECT id, slug
      FROM schools
      WHERE slug = ${schoolSlug}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (schoolRow.length === 0) {
      return json(404, { ok: false, error: "School not found" });
    }
    const schoolId = schoolRow[0].id;

    if (req.method === "GET") {
      const { from, to, difficulty } = req.query;

      const where = [
        sql/*sql*/`l.school_id = ${schoolId}`,
        sql/*sql*/`l.deleted_at IS NULL`,
      ];
      if (from) where.push(sql/*sql*/`l.start_at >= ${from}::timestamptz`);
      if (to)   where.push(sql/*sql*/`l.start_at < (${to}::date + INTERVAL '1 day')`);
      if (difficulty && difficulty !== "All") {
        where.push(sql/*sql*/`l.difficulty = ${difficulty}`);
      }

      const rows = await sql/*sql*/`
        SELECT
          l.id,
          l.start_at,
          l.duration_min,
          l.difficulty,
          l.place,
          l.capacity,
          l.notes,
          l.created_at,
          l.updated_at
        FROM lessons l
        WHERE ${sql.join(where, sql/*sql*/` AND `)}
        ORDER BY l.start_at ASC
      `;
      return json(200, { ok: true, data: rows });
    }

    if (req.method === "POST") {
      const { startAt, durationMin, difficulty, place, coachIds } = req.body || {};

      if (!startAt) return json(400, { ok: false, error: "Missing body.startAt (ISO string)" });
      if (!durationMin || Number.isNaN(Number(durationMin))) {
        return json(400, { ok: false, error: "Missing/invalid body.durationMin" });
      }
      if (!difficulty) return json(400, { ok: false, error: "Missing body.difficulty" });
      if (!place) return json(400, { ok: false, error: "Missing body.place" });

      const ins = await sql/*sql*/`
        INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
        VALUES (${schoolId}, ${startAt}::timestamptz, ${durationMin}, ${difficulty}, ${place})
        RETURNING id, start_at, duration_min, difficulty, place, created_at, updated_at
      `;
      const lesson = ins[0];

      // ---- FIXED BULK INSERT FOR lesson_coaches ----
      if (Array.isArray(coachIds) && coachIds.length > 0) {
        const values = coachIds
          .filter((c) => typeof c === "string" && c.trim() !== "")
          .map((coachId) => sql/*sql*/`(${lesson.id}, ${coachId})`);

        if (values.length > 0) {
          await sql/*sql*/`
            INSERT INTO lesson_coaches (lesson_id, coach_id)
            VALUES ${sql.join(values, sql/*sql*/`, `)}
            ON CONFLICT DO NOTHING
          `;
        }
      }
      // ----------------------------------------------

      return json(201, { ok: true, data: lesson });
    }

    res.setHeader("Allow", "GET, POST");
    return json(405, { ok: false, error: "Method not allowed" });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "Server error", detail: err?.detail || err?.message || String(err) });
  }
}
