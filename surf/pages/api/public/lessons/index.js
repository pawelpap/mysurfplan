// surf/pages/api/public/lessons/index.js
import { sql } from '../../../lib/db'; // <-- your Neon pg client wrapper that exports `sql`
import { v4 as uuidv4 } from 'uuid';

function safeJson(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

// util: coerce difficulty to one of the three
const DIFF = new Set(['Beginner', 'Intermediate', 'Advanced']);
function normDifficulty(x) {
  if (typeof x !== 'string') return 'Beginner';
  const clean = x.trim();
  return DIFF.has(clean) ? clean : 'Beginner';
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // GET /api/public/lessons?school=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=<opt>
      const { school, from, to, difficulty } = req.query;
      if (!school) {
        return res.status(400).json({ ok: false, error: 'Missing ?school=<slug>' });
      }

      // Resolve school id
      const schoolRows = await sql`
        SELECT id FROM schools
        WHERE slug = ${school} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (schoolRows.length === 0) {
        return res.status(404).json({ ok: false, error: 'School not found' });
      }
      const schoolId = schoolRows[0].id;

      // Build filters
      const filters = [sql`l.school_id = ${schoolId}`, sql`l.deleted_at IS NULL`];
      if (from) filters.push(sql`l.start_at >= ${from}::date`);
      if (to) filters.push(sql`l.start_at < (${to}::date + INTERVAL '1 day')`);
      if (difficulty) filters.push(sql`l.difficulty = ${normDifficulty(difficulty)}`);

      const rows = await sql`
        SELECT
          l.id,
          l.school_id as "schoolId",
          l.start_at   as "startAt",
          l.duration_min as "durationMin",
          l.difficulty,
          l.place
        FROM lessons l
        WHERE ${sql.join(filters, sql` AND `)}
        ORDER BY l.start_at ASC
        LIMIT 500
      `;

      return res.json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      // POST /api/public/lessons?school=<slug>
      // body: { startAt: ISO, durationMin?, difficulty?, place?, coachIds?[] }
      const { school } = req.query;
      if (!school) {
        return res.status(400).json({ ok: false, error: 'Missing ?school=<slug>' });
      }

      const body = safeJson(req.body);
      const { startAt, durationMin, difficulty, place, coachIds } = body;

      if (!startAt) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing body.startAt (ISO string)' });
      }

      // Validate & normalize inputs
      const startDate = new Date(startAt);
      if (isNaN(startDate.getTime())) {
        return res
          .status(400)
          .json({ ok: false, error: 'Invalid startAt; must be ISO date-time' });
      }
      const dur = Number.isFinite(Number(durationMin)) ? Number(durationMin) : 90;
      const diff = normDifficulty(difficulty);
      const plc = (place || '').toString().trim();

      // Resolve school id
      const schoolRows = await sql`
        SELECT id FROM schools
        WHERE slug = ${school} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (schoolRows.length === 0) {
        return res.status(404).json({ ok: false, error: 'School not found' });
      }
      const schoolId = schoolRows[0].id;

      // Insert lesson
      const inserted = await sql`
        INSERT INTO lessons (id, school_id, start_at, duration_min, difficulty, place)
        VALUES (${uuidv4()}, ${schoolId}, ${startDate.toISOString()}, ${dur}, ${diff}, ${plc})
        RETURNING id, school_id as "schoolId", start_at as "startAt",
                  duration_min as "durationMin", difficulty, place
      `;
      const lesson = inserted[0];

      // Optionally assign coaches (coachIds: array of uuids)
      if (Array.isArray(coachIds) && coachIds.length) {
        for (const cid of coachIds) {
          // silently ignore invalid uuids here for simplicity
          await sql`
            INSERT INTO lesson_coaches (lesson_id, coach_id)
            VALUES (${lesson.id}, ${cid})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      return res.status(201).json({ ok: true, data: lesson });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    // Surface useful details during setup
    return res.status(500).json({ ok: false, error: 'Server error', detail: e.message });
  }
}
