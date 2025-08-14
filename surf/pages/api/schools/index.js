// surf/pages/api/schools/index.js
import { sql } from 'lib/db';
import slugify from 'slugify';

/**
 * GET    /api/schools
 * POST   /api/schools   { name, contact_email? }
 * PATCH  /api/schools   { id, name?, contact_email? }
 * DELETE /api/schools   { id }
 *
 * NOTE: If `schools.slug` is a generated column in Neon, we DO NOT insert/update it explicitly.
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql/*sql*/`
        SELECT id, name, slug, contact_email AS "contactEmail",
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM schools
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { name, contact_email } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'Missing name.' });
      }

      // If your table has slug as a generated column, do NOT include it in the INSERT.
      // If it is NOT generated in your schema, uncomment the slug field below and include it.
      // const desiredSlug = slugify(name, { lower: true, strict: true });

      const [row] = await sql/*sql*/`
        INSERT INTO schools (name, contact_email)
        VALUES (${name.trim()}, ${contact_email || null})
        RETURNING id, name, slug, contact_email AS "contactEmail",
                  created_at AS "createdAt", updated_at AS "updatedAt"
      `;
      return res.status(201).json({ ok: true, data: row });
    }

    if (req.method === 'PATCH') {
      const { id, name, contact_email } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'Missing id.' });

      const updates = [];
      if (name && name.trim()) updates.push(sql/*sql*/`name = ${name.trim()}`);
      if (typeof contact_email !== 'undefined') updates.push(sql/*sql*/`contact_email = ${contact_email || null}`);

      if (updates.length === 0) {
        return res.status(400).json({ ok: false, error: 'Nothing to update.' });
      }

      const [row] = await sql/*sql*/`
        UPDATE schools
        SET ${sql.join(updates, sql/*sql*/`, `)}, updated_at = now()
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id, name, slug, contact_email AS "contactEmail",
                  created_at AS "createdAt", updated_at AS "updatedAt"
      `;
      if (!row) return res.status(404).json({ ok: false, error: 'School not found.' });
      return res.status(200).json({ ok: true, data: row });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'Missing id.' });

      const [row] = await sql/*sql*/`
        UPDATE schools
        SET deleted_at = now()
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id
      `;
      if (!row) return res.status(404).json({ ok: false, error: 'School not found.' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error', detail: err.message });
  }
}
