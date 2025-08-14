// surf/pages/api/schools/index.js
import { sql } from '../../../lib/db'; // <-- relative path (no @ alias)

// small slugger
function slugify(name = '') {
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'school';
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql(
        `
        SELECT id, name, slug, contact_email, created_at
        FROM schools
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        `,
        []
      );
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { name, slug: slugRaw, contactEmail } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'Missing body.name' });
      }
      const slug = slugRaw?.trim() || slugify(name);

      const exists = await sql(
        `SELECT 1 FROM schools WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
        [slug]
      );
      if (exists.length) {
        return res.status(409).json({ ok: false, error: 'Slug already in use' });
      }

      const rows = await sql(
        `
        INSERT INTO schools (name, slug, contact_email)
        VALUES ($1, $2, $3)
        RETURNING id, name, slug, contact_email, created_at
        `,
        [name.trim(), slug, contactEmail || null]
      );

      return res.status(201).json({ ok: true, data: rows[0] });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

      await sql(`UPDATE schools SET deleted_at = NOW() WHERE id = $1`, [id]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    console.error('Schools API error:', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Server error', detail: e?.message });
  }
}
