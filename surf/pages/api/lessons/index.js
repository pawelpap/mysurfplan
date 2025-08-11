// surf/pages/api/lessons/index.js
import { sql } from '@vercel/postgres';

// Only ensure the bookings table; do NOT touch the lessons table schema.
async function ensureBookings() {
  await sql`CREATE TABLE IF NOT EXISTS bookings (
    lesson_id text NOT NULL,
    name text,
    email text NOT NULL,
    UNIQUE(lesson_id, email)
  );`;
}

function mapRow(r) {
  return {
    id: r.id, // keep original type from DB
    startISO: r.start_iso instanceof Date ? r.start_iso.toISOString() : r.start_iso,
    durationMin: r.duration_min,
    difficulty: r.difficulty,
    place: r.place,
    attendees: r.attendees ?? [],
  };
}

export default async function handler(req, res) {
  const method = req.method;

  try {
    if (method === 'GET') {
      await ensureBookings();

      // Join by casting lessons.id to text so it matches bookings.lesson_id (text)
      const { rows } = await sql`
        SELECT
          l.id,
          l.start_iso,
          l.duration_min,
          l.difficulty,
          l.place,
          COALESCE(
            json_agg(json_build_object('name', b.name, 'email', b.email))
              FILTER (WHERE b.email IS NOT NULL),
            '[]'
          ) AS attendees
        FROM lessons l
        LEFT JOIN bookings b ON b.lesson_id = l.id::text
        GROUP BY l.id
        ORDER BY l.start_iso ASC;
      `;

      return res.status(200).json({ ok: true, data: rows.map(mapRow) });
    }

    if (method === 'POST') {
      // Do NOT create/alter lessons table here; we assume it already exists with compatible columns.
      const { startISO, difficulty, place } = req.body || {};
      if (!startISO || !difficulty || !place) {
        return res.status(400).json({ ok: false, error: 'Missing fields' });
      }

      const durationMin = 90;
      const insert = await sql`
        INSERT INTO lessons (start_iso, duration_min, difficulty, place)
        VALUES (${startISO}, ${durationMin}, ${difficulty}, ${place})
        RETURNING id, start_iso, duration_min, difficulty, place;
      `;

      const row = insert.rows[0];
      return res.status(200).json({
        ok: true,
        data: { ...mapRow(row), attendees: [] },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('lessons index error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
