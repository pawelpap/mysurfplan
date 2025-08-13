// surf/pages/api/public/lessons/index.js
import { sql } from '@vercel/postgres';

/**
 * GET /api/public/lessons?school=<slug>&difficulty=<opt>&from=<yyyy-mm-dd>&to=<yyyy-mm-dd>
 * Returns upcoming lessons for a school (public view).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { school, difficulty, from, to } = req.query;

    if (!school || typeof school !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing or invalid "school" (slug) parameter.' });
    }

    // 1) Resolve school by slug
    const { rows: schools } = await sql`
      SELECT id, slug, name
      FROM schools
      WHERE slug = ${school}
      LIMIT 1;
    `;

    if (schools.length === 0) {
      return res.status(404).json({ ok: false, error: 'School not found.' });
    }
    const schoolId = schools[0].id;

    // 2) Build a plain parameterized SQL query (no sql.join / no array .join)
    let text = `
      SELECT
        l.id,
        l.start_at       AS "startAt",
        l.duration_min   AS "durationMin",
        l.difficulty,
        l.place,
        l.capacity,
        (
          SELECT COUNT(*)::int
          FROM bookings b
          WHERE b.lesson_id = l.id
        ) AS "bookedCount"
      FROM lessons l
      WHERE l.school_id = $1
    `;
    const values = [schoolId];
    let i = 2;

    if (difficulty) {
      text += ` AND l.difficulty = $${i}`;
      values.push(difficulty);
      i++;
    }
    if (from) {
      // normalize yyyy-mm-dd -> start of day
      text += ` AND l.start_at >= $${i}`;
      values.push(`${from}T00:00:00`);
      i++;
    }
    if (to) {
      // normalize yyyy-mm-dd -> end of day
      text += ` AND l.start_at <= $${i}`;
      values.push(`${to}T23:59:59`);
      i++;
    }

    text += ` ORDER BY l.start_at ASC LIMIT 500;`;

    // 3) Execute
    const { rows } = await sql.query(text, values);

    // Optionally: guarantee arrays for fields we’ll render later
    const safeRows = rows.map((r) => ({
      ...r,
      // ensure numbers
      durationMin: typeof r.durationMin === 'number' ? r.durationMin : 90,
      bookedCount: typeof r.bookedCount === 'number' ? r.bookedCount : 0,
    }));

    return res.status(200).json({ ok: true, data: safeRows });
  } catch (e) {
    // Return a friendly error string to the UI (and log the full error in functions logs)
    console.error('Public lessons error:', e);
    return res.status(500).json({ ok: false, error: 'Failed to load lessons.' });
  }
}
