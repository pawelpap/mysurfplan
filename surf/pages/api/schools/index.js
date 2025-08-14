// surf/pages/api/schools/index.js
import { sql } from '@/lib/db'; // your Neon client must export { sql }

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, slug, contact_email, created_at
        FROM schools
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      // Expect JSON: { name, slug?, contactEmail? }
      // We also accept "schoolSlug" (legacy) for convenience.
      const body =
        typeof req.body === 'string'
          ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })()
          : (req.body || {});
      const { name, slug, schoolSlug, contactEmail } = body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ ok: false, error: 'Missing body.name' });
      }

      const finalSlug = (slug || schoolSlug || slugify(name)).trim();
      const contact = contactEmail ? String(contactEmail).trim() : null;

      try {
        const rows = await sql`
          INSERT INTO schools (name, slug, contact_email)
          VALUES (${name}, ${finalSlug}, ${contact})
          RETURNING id, name, slug, contact_email, created_at
        `;
        return res.status(201).json({ ok: true, data: rows[0] });
      } catch (err) {
        if (err?.code === '23505') {
          // unique_violation
          return res
            .status(409)
            .json({ ok: false, error: 'Slug already exists', detail: err.detail });
        }
        throw err;
      }
    }

    if (req.method === 'DELETE') {
      // Expect query: /api/schools?id=<uuid>
      // (The test page below calls it exactly like this.)
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
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      code: err?.code,
      detail: err?.detail || err?.message || String(err),
    });
  }
}
