// surf/pages/api/public/lessons.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { school, from, to, difficulty } = req.query;
    if (!school) return res.status(200).json({ ok: true, data: [] });

    const { rows: srows } = await sql`
      SELECT id FROM schools
      WHERE (id::text = ${school} OR slug = ${school}) AND deleted_at IS NULL
      LIMIT 1
    `;
    const sid = srows[0]?.id;
    if (!sid) return res.status(200).json({ ok: true, data: [] });

    const fromISO = from ? new Date(from).toISOString() : null;
    const toISO = to ? new Date(to + 'T23:59:59').toISOString() : null;

    const { rows } = await sql`
      SELECT
        l.id,
        l.start_iso,
        l.duration_min,
        l.difficulty,
        l.place,
        COALESCE(ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL), '{}') AS coaches,
        (
          SELECT COUNT(*) FROM bookings b
          WHERE b.lesson_id = l.id AND b.canceled_at IS NULL
        ) AS booked
      FROM lessons l
      LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
      LEFT JOIN coaches c ON c.id = lc.coach_id AND c.deleted_at IS NULL
      WHERE l.deleted_at IS NULL
        AND l.school_id = ${sid}
        AND l.start_iso >= NOW()
        ${fromISO ? sql`AND l.start_iso >= ${fromISO}` : sql``}
        ${toISO ? sql`AND l.start_iso <= ${toISO}` : sql``}
        ${difficulty ? sql`AND l.difficulty = ${difficulty}` : sql``}
      GROUP BY l.id
      ORDER BY l.start_iso ASC
    `;

    const data = rows.map(r => ({
      id: r.id,
      startISO: r.start_iso,
      durationMin: r.duration_min,
      difficulty: r.difficulty,
      place: r.place,
      coaches: r.coaches,
      booked: Number(r.booked || 0),
    }));
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Public lessons API error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
