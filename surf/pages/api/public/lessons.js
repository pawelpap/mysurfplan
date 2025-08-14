// pages/api/public/lessons.js
// Public Lessons API (read + create). Uses Neon via pg Pool.

import { pool } from "../../../lib/db";

/* ----------------------------- helpers ----------------------------- */

function ok(res, data) {
  res.status(200).json({ ok: true, data });
}
function bad(res, msg) {
  res.status(400).json({ ok: false, error: msg });
}
function boom(res, err) {
  console.error("[/api/public/lessons] server error:", err);
  const detail = err?.detail || err?.message;
  res.status(500).json({ ok: false, error: "Server error", detail });
}

const DIFFICULTIES = new Set(["Beginner", "Intermediate", "Advanced"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** parse comma separated or array into UUID[] (filters invalid) */
function toUuidArray(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : String(input).split(",");
  return arr
    .map((s) => String(s).trim())
    .filter((s) => UUID_RE.test(s));
}

/** ISO to Date or null */
function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* ----------------------------- handler ----------------------------- */

export default async function handler(req, res) {
  if (req.method === "GET") {
    return getLessons(req, res);
  }
  if (req.method === "POST") {
    return createLesson(req, res);
  }
  res.setHeader("Allow", "GET, POST");
  return bad(res, "Method not allowed");
}

/* ------------------------------- GET --------------------------------
   Query params:
     - school   : school slug (required)
     - from     : YYYY-MM-DD (inclusive)
     - to       : YYYY-MM-DD (inclusive)
     - difficulty: Beginner|Intermediate|Advanced (optional)
------------------------------------------------------------------------*/
async function getLessons(req, res) {
  const { school, from, to, difficulty } = req.query;

  if (!school || typeof school !== "string") {
    return bad(res, "Missing query.school (school slug).");
  }
  if (difficulty && !DIFFICULTIES.has(String(difficulty))) {
    return bad(res, "Invalid difficulty.");
  }

  // Build parameterized SQL
  const params = [];
  let idx = 1;

  // Base: scope to a single school; hide soft-deleted records
  let sql = `
    SELECT
      l.id,
      l.school_id,
      s.slug AS school_slug,
      l.start_at,
      l.duration_min,
      l.difficulty,
      l.place,
      l.capacity,
      l.created_at,
      l.updated_at
    FROM lessons l
    JOIN schools s ON s.id = l.school_id
    WHERE s.slug = $${idx++}
      AND l.deleted_at IS NULL
  `;
  params.push(school);

  const fromDate = toDateOrNull(from);
  if (fromDate) {
    sql += ` AND l.start_at >= $${idx++}`;
    params.push(fromDate.toISOString());
  }
  const toDate = toDateOrNull(to);
  if (toDate) {
    // inclusive end-of-day
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    sql += ` AND l.start_at <= $${idx++}`;
    params.push(end.toISOString());
  }
  if (difficulty) {
    sql += ` AND l.difficulty = $${idx++}`;
    params.push(String(difficulty));
  }

  sql += " ORDER BY l.start_at ASC";

  try {
    const { rows } = await pool.query(sql, params);
    return ok(res, rows);
  } catch (err) {
    return boom(res, err);
  }
}

/* ------------------------------ POST --------------------------------
   Body JSON:
     - schoolSlug | scope : school slug (required; `scope` is accepted too)
     - startAt             : ISO string (required)
     - durationMin         : integer minutes (default 90)
     - difficulty          : Beginner|Intermediate|Advanced (default Beginner)
     - place               : string (required)
     - coachIds            : array or comma-separated UUIDs (optional)
------------------------------------------------------------------------*/
async function createLesson(req, res) {
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return bad(res, "Invalid JSON body.");
  }

  // accept both schoolSlug and scope to match the current form
  const schoolSlug = body.schoolSlug || body.scope;
  if (!schoolSlug || typeof schoolSlug !== "string") {
    return bad(res, "Missing body.schoolSlug (school slug).");
  }

  const startAt = toDateOrNull(body.startAt);
  if (!startAt) {
    return bad(res, "Missing body.startAt (ISO string).");
  }

  const durationMin =
    body.durationMin != null ? parseInt(body.durationMin, 10) : 90;
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    return bad(res, "Invalid durationMin.");
  }

  const difficulty = body.difficulty || "Beginner";
  if (!DIFFICULTIES.has(String(difficulty))) {
    return bad(res, "Invalid difficulty.");
  }

  const place = (body.place || "").trim();
  if (!place) {
    return bad(res, "Missing place.");
  }

  const coachIds = toUuidArray(body.coachIds);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find school
    const sRes = await client.query(
      "SELECT id FROM schools WHERE slug = $1 AND deleted_at IS NULL",
      [schoolSlug]
    );
    if (sRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return bad(res, "School not found.");
    }
    const schoolId = sRes.rows[0].id;

    // Insert lesson
    const ins = await client.query(
      `INSERT INTO lessons
         (school_id, start_at, duration_min, difficulty, place)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, school_id, start_at, duration_min, difficulty, place, created_at, updated_at`,
      [
        schoolId,
        startAt.toISOString(),
        durationMin,
        String(difficulty),
        place,
      ]
    );
    const lesson = ins.rows[0];

    // Optional: attach coaches
    if (coachIds.length > 0) {
      await client.query(
        `INSERT INTO lesson_coaches (lesson_id, coach_id)
         SELECT $1, x::uuid
         FROM unnest($2::uuid[]) AS x`,
        [lesson.id, coachIds]
      );
    }

    await client.query("COMMIT");
    return ok(res, lesson);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      /* ignore */
    }
    return boom(res, err);
  } finally {
    client.release();
  }
}
