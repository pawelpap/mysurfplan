// surf/pages/api/schools/index.js
import { sql } from '@/lib/db'; // this comes from your Neon client in lib/db

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')            // drop quotes
    .replace(/[^a-z0-9]+/g, '-')     // non-alnum -> hyphen
    .replace(/^-+|-+$/g, '');        // trim hyphens
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // List schools
      const rows = await sql`
        SELECT id, name, slug, contact_email, created_at
        FROM schools
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      // Create a school
      const { name, slug, contactEmail } = (req.body || {});
      if (!name || !String(name).trim()) {
        return res.status(400).json({ ok: false, error: 'Missing body.name' });
      }

      const finalSlug = (slug && String(slug).trim()) || slugify(name);
      const contact = contactEmail ? String(contactEmail).trim() : null;

      try {
        const rows = await sql`
          INSERT INTO schools (name, slug, contact_email)
          VALUES (${name}, ${finalSlug}, ${contact})
          RETURNING id, name, slug, contact_email, created_at
        `;
        return res.status(201).json({ ok: true, data: rows[0] });
      } catch (err) {
        // 23505 = unique_violation
        if (err?.code === '23505') {
          return res
            .status(409)
            .json({ ok: false, error: 'Slug already exists', detail: err.detail });
        }
        throw err;
      }
    }

    if (req.method === 'DELETE') {
      // Optional: delete by id (hard delete)
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ ok: false, error: 'Missing query.id' });
      }
      await sql`DELETE FROM schools WHERE id = ${id}`;
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    // Neon errors expose .message and sometimes .detail and .code
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      detail: err?.detail || err?.message || String(err),
    });
  }
}
