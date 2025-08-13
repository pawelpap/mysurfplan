// surf/pages/api/schools/index.js
import pool from '../../../lib/db';

// mini slugify (no external dependency)
function toSlug(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')          // non-alphanum -> hyphen
    .replace(/^-+|-+$/g, '')              // trim hyphens
    .substring(0, 80);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { name } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'School name is required' });
      }
      const slug = toSlug(name);

      // Insert only columns we’re sure exist (name, slug)
      const insertSql = `
        INSERT INTO schools (name, slug)
        VALUES ($1, $2)
        RETURNING id, name, slug, created_at, updated_at
      `;
      const { rows } = await pool.query(insertSql, [name.trim(), slug]);
      return res.status(201).json({ ok: true, school: rows[0] });
    }

    if (req.method === 'GET') {
      const listSql = `
        SELECT id, name, slug, created_at, updated_at
        FROM schools
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      const { rows } = await pool.query(listSql);
      return res.status(200).json({ ok: true, schools: rows });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('SCHOOLS API error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: err.message });
  }
}
