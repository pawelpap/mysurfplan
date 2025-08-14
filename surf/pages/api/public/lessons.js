// surf/pages/api/public/lessons.js
import pool from "../../../lib/db";

function bad(res, msg, code = 400, extra = {}) {
  return res.status(code).json({ ok: false, error: msg, ...extra });
}
function ok(res, data) {
  return res.status(200).json({ ok: true, data });
}
function toISODateOnly(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())).toISOString();
}

export default async function handler(req, res) {
  if (req.method === "HEAD" || req.method === "OPTIONS") {
    res.setHeader("Allow", "GET,POST,OPTIONS,HEAD");
    return res.status(204).end();
  }

  try {
    if (req.method === "GET") {
      // /api/public/lessons?school=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=Beginner
      const { school, from, to, difficulty } = req.query;
      if (!school || typeof school !== "string" || !school.trim()) {
        return bad(res, "Missing query.school (school slug).");
      }

      const params = [];
      const where = [];
      where.push(`s.slug = $${params.push(school.trim())}`);
      where.push(`l.deleted_at IS NULL`);

      if (from) {
        const fromISO = toISODateOnly(from);
        if (!fromISO) return bad(res, "Invalid 'from' date. Use YYYY-MM-DD.");
        where.push(`l.start_at >= $${params.push(fromISO)}`);
      }
      if (to) {
        const toISO = toISODateOnly(to);
        if (!toISO) return bad(res, "Invalid 'to' date. Use YYYY-MM-DD.");
        const dt = new Date(toISO);
        const next = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
        where.push(`l.start_at < $${params.push(next.toISOString())}`);
      }
      if (difficulty) {
        where.push(`l.difficulty = $${params.push(difficulty)}`);
      }

      const sql = `
        SELECT
          l.id,
          l.school_id,
          l.start_at,
          l.duration_min,
          l.difficulty,
          l.place,
          l.capacity,
          l.created_at,
          l.updated_at
        FROM lessons l
        JOIN schools s ON s.id = l.school_id
        WHERE ${where.join(" AND ")}
        ORDER BY l.start_at ASC, l.created_at ASC
        LIMIT 500
      `;
      const { rows } = await pool.query(sql, params);

      const data = rows.map((r) => ({
        id: r.id,
        schoolId: r.school_id,
        startAt: r.start_at ? new Date(r.start_at).toISOString() : null,
        durationMin: r.duration_min,
        difficulty: r.difficulty,
        place: r.place,
        capacity: r.capacity,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      }));
      return ok(res, data);
    }

    if (req.method === "POST") {
      if (!req.headers["content-type"]?.includes("application/json")) {
        return bad(res, "Content-Type must be application/json");
      }
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const {
        schoolSlug,
        startAt,
        durationMin = 90,
        difficulty = "Beginner",
        place = "",
        coachIds,
      } = body;

      if (!schoolSlug || typeof schoolSlug !== "string") {
        return bad(res, "Missing body.schoolSlug (school slug).");
      }
      if (!startAt || typeof startAt !== "string") {
        return bad(res, "Missing body.startAt (ISO string)");
      }
      const startDate = new Date(startAt);
      if (isNaN(startDate.getTime())) {
        return bad(res, "Invalid body.startAt (must be ISO date string).");
      }

      let client;
      try {
        client = await pool.connect();
        await client.query("BEGIN");

        const rSchool = await client.query(
          `SELECT id FROM schools WHERE slug = $1 AND deleted_at IS NULL`,
          [schoolSlug.trim()]
        );
        if (rSchool.rowCount === 0) {
          await client.query("ROLLBACK");
          return bad(res, "School not found.", 404);
        }
        const schoolId = rSchool.rows[0].id;

        const ins = await client.query(
          `INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, school_id, start_at, duration_min, difficulty, place, created_at, updated_at`,
          [schoolId, startDate.toISOString(), durationMin, difficulty, place]
        );
        const lesson = ins.rows[0];

        // Optional coach links (if lesson_coaches exists)
        let coachList = [];
        if (typeof coachIds === "string" && coachIds.trim()) {
          coachList = coachIds.split(",").map((s) => s.trim()).filter(Boolean);
        } else if (Array.isArray(coachIds)) {
          coachList = coachIds.map(String).map((s) => s.trim()).filter(Boolean);
        }
        if (coachList.length) {
          const values = [];
          const params = [];
          coachList.forEach((cId) => {
            params.push(lesson.id, cId);
            values.push(`($${params.length - 1}, $${params.length})`);
          });
          await client.query(
            `INSERT INTO lesson_coaches (lesson_id, coach_id)
             VALUES ${values.join(",")}
             ON CONFLICT DO NOTHING`,
            params
          );
        }

        await client.query("COMMIT");

        return ok(res, {
          id: lesson.id,
          schoolId: lesson.school_id,
          startAt: new Date(lesson.start_at).toISOString(),
          durationMin: lesson.duration_min,
          difficulty: lesson.difficulty,
          place: lesson.place,
          createdAt: new Date(lesson.created_at).toISOString(),
          updatedAt: new Date(lesson.updated_at).toISOString(),
        });
      } catch (e) {
        try { await pool.query("ROLLBACK"); } catch {}
        return bad(res, "Database error creating lesson.", 500, { detail: e.message });
      } finally {
        try { /* client?.release?.() */ } catch {}
      }
    }

    res.setHeader("Allow", "GET,POST,OPTIONS,HEAD");
    return bad(res, "Method not allowed", 405);
  } catch (e) {
    return bad(res, "Server error", 500, { detail: e.message });
  }
}
