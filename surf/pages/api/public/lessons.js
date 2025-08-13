import { sql } from '../../../lib/db';
import { getSchoolBySlug } from '../../../lib/slug';
import { ok, fail, sendJson } from '../../../lib/result';

// Helper to map snake_case from SQL to camelCase for the UI
function mapLessonRow(r) {
  return {
    id: r.id,
    startAt: r.start_at,
    durationMin: r.duration_min,
    difficulty: r.difficulty,
    place: r.place,
    capacity: r.capacity,
    bookedCount: r.booked_count ?? 0,
    spotsLeft: r.spots_left ?? null,
    coaches: Array.isArray(r.coaches) ? r.coaches : (r.coaches ? JSON.parse(r.coaches) : []),
  };
}

export default async function handler(req, res) {
  try {
    const { school, from, to, difficulty } = req.query || {};
    if (!school) return sendJson(res, fail('Missing ?school=<slug>'), 400);

    const s = await getSchoolBySlug(school);
    if (!s) return sendJson(res, fail('School not found', 404), 404);

    // Build WHERE conditions dynamically
    const where = [sql`l.school_id = ${s.id} AND l.deleted_at IS NULL`];

    if (from) where.push(sql`l.start_at >= ${new Date(from)}`);
    if (to)   where.push(sql`l.start_at <= ${new Date(to + 'T23:59:59')}`);
    if (difficulty) where.push(sql`l.difficulty = ${difficulty}`);

    const rows = await sql`
      SELECT
        l.id,
        l.start_at,
        l.duration_min,
        l.difficulty,
        l.place,
        l.capacity,
        ls.booked_count,
        ls.spots_left,
        lcl.coaches
      FROM lessons l
      LEFT JOIN lesson_stats ls ON ls.lesson_id = l.id
      LEFT JOIN lesson_coach_list lcl ON lcl.lesson_id = l.id
      WHERE ${sql.join(where, sql` AND `)}
      ORDER BY l.start_at ASC
      LIMIT 500
    `;

    return sendJson(res, ok(rows.map(mapLessonRow)));
  } catch (e) {
    return sendJson(res, fail(e.message || 'Server error', 500), 500);
  }
}

export const config = {
  api: { bodyParser: false },
};
