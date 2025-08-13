// surf/pages/api/public/lessons.js
import { sql } from '@vercel/postgres';

/**
 * GET /api/public/lessons?school=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=Beginner|Intermediate|Advanced
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { school, from, to, difficulty } = req.query;
    if (!school || typeof school !== 'string') {
      return res
        .status(400)
        .json({ ok: false, error: 'Missing or invalid "school" (slug)' });
    }

    // Resolve school id
    const s = await sql`
      SELECT id FROM schools
      WHERE slug = ${school} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (s.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'School not found' });
    }
    const schoolId = s.rows[0].id;

    // ---- Detect which timestamp column exists on lessons ----
    const cols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'lessons'
        AND column_name IN ('start_utc', 'start_iso', 'start_at', 'start_time')
    `;

    if (cols.rowCount === 0) {
      return res
        .status(500)
        .json({ ok: false, error: 'Server error', detail: 'No start timestamp column found on lessons' });
    }

    // Choose the best candidate and build a TIMESTAMPTZ expression we can use everywhere
    let tsExpr; // sql`` fragment yielding a timestamptz
    let colChosen = null;

    const names = cols.rows.map(r => r.column_name);

    if (names.includes('start_utc')) {
      tsExpr = sql`l.start_utc`;
      colChosen = 'start_utc';
    } else if (names.includes('start_at')) {
      tsExpr = sql`l.start_at`;
      colChosen = 'start_at';
    } else if (names.includes('start_time')) {
      tsExpr = sql`l.start_time`;
      colChosen = 'start_time';
    } else if (names.includes('start_iso')) {
      // Cast string ISO timestamps to timestamptz at query time
      tsExpr = sql`l.start_iso::timestamptz`;
      colChosen = 'start_iso';
    }

    if (!tsExpr) {
      return res
        .status(500)
        .json({ ok: false, error: 'Server error', detail: 'Unsupported lessons timestamp layout' });
    }

    // ---- Build filters ----
    const clauses = [
      sql`l.school_id = ${schoolId}`,
      sql`l.deleted_at IS NULL`,
    ];

    if (from) {
      const fromUtc = new Date(`${from}T00:00:00Z`);
      if (isNaN(+fromUtc)) return res.status(400).json({ ok: false, error: 'Invalid "from" date' });
      clauses.push(sql`${tsExpr} >= ${fromUtc}`);
    }
    if (to) {
      const toUtc = new Date(`${to}T23:59:59Z`);
      if (isNaN(+toUtc)) return res.status(400).json({ ok: false, error: 'Invalid "to" date' });
      clauses.push(sql`${tsExpr} <= ${toUtc}`);
    }
    if (difficulty) {
      if (!['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)) {
        return res.status(400).json({ ok: false, error: 'Invalid "difficulty" value' });
      }
      clauses.push(sql`l.difficulty = ${difficulty}`);
    }

    // Stitch WHERE from fragments (no sql.join)
    let where = sql``;
    clauses.forEach((c, i) => {
      where = i === 0 ? sql`${c}` : sql`${where} AND ${c}`;
    });

    // ---- Query lessons with coaches ----
    const { rows } = await sql`
      SELECT
        l.id,
        ${tsExpr}            AS start_utc,
        l.duration_min,
        l.difficulty,
        l.place,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', c.id, 'name', c.name)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS coaches
      FROM lessons l
      LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
      LEFT JOIN coaches c ON c.id = lc.coach_id AND c.deleted_at IS NULL
      WHERE ${where}
      GROUP BY l.id, ${tsExpr}
      ORDER BY ${tsExpr} ASC
      LIMIT 500
    `;

    return res.status(200).json({ ok: true, data: rows, meta: { tsColumn: colChosen } });
  } catch (err) {
    console.error('Public lessons error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Server error', detail: err?.message?.slice(0, 300) });
  }
}
