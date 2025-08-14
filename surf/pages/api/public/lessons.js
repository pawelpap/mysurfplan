// surf/pages/api/public/lessons.js
import { sql } from 'lib/db';

/**
 * GET  /api/public/lessons?school=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD&difficulty=Beginner|Intermediate|Advanced
 * POST /api/public/lessons    { schoolSlug, startAt, durationMin, difficulty, place, coachIds? (array of UUIDs) }
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { school, from, to, difficulty } = req.query;
      if (!school) {
        return res.status(400).json({ ok: false, error: 'Missing school (slug).' });
      }

      // Resolve school id
      const schoolRows = await sql/*sql*/`
        SELECT id
        FROM schools
        WHERE slug = ${school} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (schoolRows.length === 0) {
        return res.status(404).json({ ok: false, error: 'School not found.' });
      }
      const schoolId = schoolRows[0].id;

      // Build dynamic WHERE parts
      const clauses = [sql/*sql*/`l.school_id = ${schoolId}`, sql/*sql*/`l.deleted_at IS NULL`];

      if (from) {
        const fromUtc = new Date(`${from}T00:00:00Z`).toISOString();
        clauses.push(sql/*sql*/`l.start_at >= ${fromUtc}`);
      }
      if (to) {
        const toUtc = new Date(`${to}T23:59:59Z`).toISOString();
        clauses.push(sql/*sql*/`l.start_at <= ${toUtc}`);
      }
      if (difficulty) {
        clauses.push(sql/*sql*/`l.difficulty = ${difficulty}`);
      }

      const rows = await sql/*sql*/`
        SELECT
          l.id,
          l.start_at     AS "startAt",
          l.duration_min AS "durationMin",
          l.difficulty,
          l.place,
          l.capacity,
          l.created_at   AS "createdAt",
          l.updated_at   AS "updatedAt"
        FROM lessons l
        WHERE ${sql.join(clauses, sql/*sql*/` AND `)}
        ORDER BY l.start_at ASC
      `;

      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { schoolSlug, startAt, durationMin, difficulty, place, coachIds } = req.body || {};

      if (!schoolSlug) {
        return res.status(400).json({ ok: false, error: 'Missing body.schoolSlug (school slug).' });
      }
      if (!startAt) {
        return res.status(400).json({ ok: false, error: 'Missing body.startAt (ISO string).' });
      }

      const schoolRows = await sql/*sql*/`
        SELECT id FROM schools WHERE slug = ${schoolSlug} AND deleted_at IS NULL LIMIT 1
      `;
      if (schoolRows.length === 0) {
        return res.status(404).json({ ok: false, error: 'School not found.' });
      }
      const schoolId = schoolRows[0].id;

      const startISO = new Date(startAt).toISOString();
      const dur = Number.isFinite(+durationMin) ? +durationMin : 90;
      const diff = difficulty || 'Beginner';
      const plc = (place || '').trim();

      // Create the lesson in a transaction and attach coaches if provided
      const created = await sql.begin(async (trx) => {
        const [lesson] = await trx/*sql*/`
          INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
          VALUES (${schoolId}, ${startISO}, ${dur}, ${diff}, ${plc})
          RETURNING
            id,
            start_at     AS "startAt",
            duration_min AS "durationMin",
            difficulty,
            place
        `;

        if (Array.isArray(coachIds) && coachIds.length > 0) {
          // Insert only valid UUID-looking values; ignore bad entries
          const cleanIds = coachIds
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter((v) => v.length > 0);

          if (cleanIds.length > 0) {
            await trx/*sql*/`
              INSERT INTO lesson_coaches (lesson_id, coach_id)
              SELECT ${lesson.id}, c.id
              FROM coaches c
              WHERE c.id = ANY (${cleanIds}::uuid[])
            `;
          }
        }

        return lesson;
      });

      return res.status(201).json({ ok: true, data: created });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error', detail: err.message });
  }
}
