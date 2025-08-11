// surf/pages/api/lessons/index.js
import { sql } from '@vercel/postgres';

async function ensureTables() {
  // Dedicated, clash-free tables for this app.
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS surf_lessons (
      id        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      start_iso timestamptz NOT NULL,
      duration_min integer NOT NULL DEFAULT 90,
      difficulty text NOT NULL,
      place      text NOT NULL
    );
  `;

  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS surf_bookings (
      lesson_id text NOT NULL,
      name      text,
      email     text NOT NULL,
      UNIQUE (lesson_id, email)
    );
  `;
}

function mapRow(r) {
  return {
    id: r.id,
    startISO: r.start_iso instanceof Date ? r.start_iso.toISOString() : r.start_iso,
    durationMin: r.duration_min,
    difficulty: r.difficulty,
    place: r.place,
    attendees: r.attendees ?? [],
  };
}

export default async function handler(req, res) {
  try {
    await ensureTables();

    if (req.method === 'GET') {
      const { rows } = await sql/*sql*/`
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
        FROM surf_lessons l
        LEFT JOIN surf_bookings b ON b.lesson_id = l.id
        GROUP BY l.id
        ORDER BY l.start_iso ASC;
      `;
      return res.status(200).json({ ok: true, data: rows.map(mapRow) });
    }

    if (req.method === 'POST') {
      const { startISO, difficulty, place } = req.body || {};
      if (!startISO || !difficulty || !place) {
        return res.status(400).json({ ok: false, error: 'Missing fields' });
      }

      const durationMin = 90;
      const ins = await sql/*sql*/`
        INSERT INTO surf_lessons (start_iso, duration_min, difficulty, place)
        VALUES (${startISO}, ${durationMin}, ${difficulty}, ${place})
        RETURNING id, start_iso, duration_min, difficulty, place;
      `;
      return res.status(200).json({ ok: true, data: mapRow(ins.rows[0]) });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e) {
    console.error('surf_lessons index error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
