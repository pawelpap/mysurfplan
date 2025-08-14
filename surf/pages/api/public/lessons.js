// surf/pages/api/public/lessons.js
import { sql, tx } from '../../../lib/db'; // <-- relative path

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { school: schoolSlug, from, to, difficulty } = req.query || {};
      if (!schoolSlug) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing query.school (school slug).' });
      }

      const params = [schoolSlug];
      let where = `s.slug = $1 AND l.deleted_at IS NULL`;
      let p = 2;

      if (from) {
        where += ` AND l.start_at >= $${p++}`;
        params.push(new Date(from).toISOString());
      }
      if (to) {
        where += ` AND l.start_at < $${p++}`;
        const end = new Date(to);
        end.setDate(end.getDate() + 1); // exclusive upper bound
        params.push(end.toISOString());
      }
      if (difficulty) {
        where += ` AND l.difficulty = $${p++}`;
        params.push(difficulty);
      }

      const text = `
        SELECT
          l.id,
          l.start_at,
          l.duration_min,
          l.difficulty,
          l.place,
          COALESCE(
            JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'name', c.name))
            FILTER (WHERE c.id IS NOT NULL),
            '[]'
          ) AS coaches
        FROM lessons l
        JOIN schools s ON s.id = l.school_id
        LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
        LEFT JOIN coaches c ON c.id = lc.coach_id
        WHERE ${where}
        GROUP BY l.id
        ORDER BY l.start_at ASC
      `;

      const rows = await sql(text, params);
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { school: schoolSlug } = req.query || {};
      if (!schoolSlug) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing query.school (school slug).' });
      }

      const { startAt, durationMin, difficulty, place, coachIds } = req.body || {};
      if (!startAt) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing body.startAt (ISO string)' });
      }
      if (!place || !place.trim()) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing body.place' });
      }

      const schoolRows = await sql(
        `SELECT id FROM schools WHERE slug = $1 AND deleted_at IS NULL`,
        [schoolSlug]
      );
      if (!schoolRows.length) {
        return res.status(404).json({ ok: false, error: 'School not found' });
      }
      const schoolId = schoolRows[0].id;

      const created = await tx(async (q) => {
        const ins = await q(
          `
          INSERT INTO lessons (school_id, start_at, duration_min, difficulty, place)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, school_id, start_at, duration_min, difficulty, place
          `,
          [
            schoolId,
            new Date(startAt).toISOString(),
            Number(durationMin ?? 90),
            difficulty || 'Beginner',
            place.trim(),
          ]
        );
        const lesson = ins[0];

        const ids =
          Array.isArray(coachIds)
            ? coachIds
            : (typeof coachIds === 'string'
                ? coachIds.split(',').map(s => s.trim()).filter(Boolean)
                : []);

        if (ids.length) {
          const found = await q(
            `SELECT id FROM coaches WHERE id = ANY($1::uuid[]) AND school_id = $2 AND deleted_at IS NULL`,
            [ids, schoolId]
          );
          if (found.length) {
            const valuesClause = found.map((_, i) => `($1, $${i + 2})`).join(', ');
            const params = [lesson.id, ...found.map(f => f.id)];
            await q(
              `INSERT INTO lesson_coaches (lesson_id, coach_id) VALUES ${valuesClause}`,
              params
            );
          }
        }

        return lesson;
      });

      return res.status(201).json({ ok: true, data: created });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    console.error('Public lessons API error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Server error', detail: e?.message });
  }
}
