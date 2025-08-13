// surf/pages/api/schools/index.js
import { Pool } from 'pg';
import slugify from 'slugify';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { name, description, location } = req.body;

      if (!name) {
        return res.status(400).json({ ok: false, error: 'School name is required' });
      }

      const slug = slugify(name, { lower: true, strict: true });

      const insertQuery = `
        INSERT INTO schools (name, description, location, slug)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const { rows } = await pool.query(insertQuery, [name, description || '', location || '', slug]);

      return res.status(201).json({ ok: true, school: rows[0] });
    } catch (error) {
      console.error('Error creating school:', error);
      return res.status(500).json({ ok: false, error: 'Server error', detail: error.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(`SELECT * FROM schools ORDER BY created_at DESC`);
      return res.status(200).json({ ok: true, schools: rows });
    } catch (error) {
      console.error('Error fetching schools:', error);
      return res.status(500).json({ ok: false, error: 'Server error', detail: error.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
