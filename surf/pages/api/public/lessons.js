// surf/pages/api/public/lessons.js
import { q } from "../../../lib/db";

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
    const schoolSlug = typeof req.query.school === "string" ? req.query.school : null;
    if (!schoolSlug) {
      return json(400, { ok: false, error: "Missing query.school (school slug)" });
    }

    // Resolve the school once
    const schoolRows = await q(
      `SELECT id, slug FROM schools WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [schoolSlug]
    );
    if (schoolRows.length === 0) {
      return json(404, { ok: false, error: "School not found" });
    }
    const schoolId = schoolRows[0].id;

    if (req.method === "GET") {
      const { from, to, difficulty } = req.query;

      const clauses = [`l.school_id = $1`, `l.deleted_at IS NULL`];
      const params = [schoolId];

      if (from) {
        clauses.push(`l.start_at >= $${params.length + 1}`);
        params.push(from);
      }
      if (to) {
        // include the whole "to" day
        clauses.push(`l.start_at < ($${params.length + 1}::date + INTERVAL '1 day')`);
        params.push(to);
      }
      if (difficulty && difficulty !== "All") {
        clauses.push(`l.difficulty = $${params.length + 1}`);
        params.push(difficulty);
      }

      const sql = `
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
        WHERE ${clauses.join(" AND ")}
        ORDER BY l.start_at ASC
      `;

      const rows = await q(sql, params);
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

      // Insert lesson
      const ins = await q(
        `INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
         VALUES ($1, $2::timestamptz, $3, $4, $5)
         RETURNING id, start_at, duration_min, difficulty, place, created_at, updated_at`,
        [schoolId, startAt, Number(durationMin), difficulty, place]
      );
      const lesson = ins[0];

      // Optional coaches: use UNNEST to bulk-insert
      if (Array.isArray(coachIds) && coachIds.length > 0) {
        // Filter to non-empty strings to be safe
        const ids = coachIds.filter((c) => typeof c === "string" && c.trim() !== "");
        if (ids.length > 0) {
          await q(
            `INSERT INTO lesson_coaches (lesson_id, coach_id)
             SELECT $1, UNNEST($2::uuid[])
             ON CONFLICT DO NOTHING`,
            [lesson.id, ids]
          );
        }
      }

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
