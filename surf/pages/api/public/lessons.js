// surf/pages/api/public/lessons/index.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { school, from, to, difficulty } = req.query;

    if (!school) {
      return res.status(400).json({ ok: false, error: 'Missing required parameter: school' });
    }

    // Build query dynamically
    let query = `
      SELECT l.id, l.title, l.description, l.difficulty, l.start_time_utc, l.end_time_utc,
             array_agg(c.name) AS coaches
      FROM lessons l
      JOIN schools s ON l.school_id = s.id
      LEFT JOIN lesson_coaches lc ON lc.lesson_id = l.id
      LEFT JOIN coaches c ON lc.coach_id = c.id
      WHERE s.slug = $1
    `;

    const params = [school];
    let paramIndex = 2;

    if (from) {
      query += ` AND l.start_time_utc >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND l.end_time_utc <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    if (difficulty) {
      query += ` AND l.difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    query += `
      GROUP BY l.id
      ORDER BY l.start_time_utc ASC
    `;

    const { rows } = await pool.query(query, params);

    return res.status(200).json({ ok: true, lessons: rows });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    return res.status(500).json({ ok: false, error: 'Server error', detail: error.message });
  }
}
