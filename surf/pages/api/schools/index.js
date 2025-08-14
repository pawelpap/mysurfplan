// surf/pages/api/schools/index.js
import sql from '../../../lib/db';

function err(res, e, status = 500) {
  // Bubble up Postgres details when helpful
  const detail = e?.detail || e?.message || 'Server error';
  res.status(status).json({ ok: false, error: 'Server error', detail });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, slug, contact_email, created_at
        FROM schools
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { name, slug, contactEmail } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing body.name (string).' });
      }
      // NOTE: slug is a GENERATED column in DB – we must NOT insert it.
      const [row] = await sql`
        INSERT INTO schools (name, contact_email)
        VALUES (${name.trim()}, ${contactEmail || null})
        RETURNING id, name, slug, contact_email, created_at
      `;
      return res.status(201).json({ ok: true, data: row });
    }

    if (req.method === 'DELETE') {
      const { id, slug } = req.query || {};
      if (!(id || slug)) {
        return res
          .status(400)
          .json({ ok: false, error: 'Provide id or slug to delete.' });
      }
      const cond = id
        ? sql`id = ${id}::uuid`
        : sql`slug = ${slug} AND deleted_at IS NULL`;
      const [row] = await sql`
        UPDATE schools
        SET deleted_at = now()
        WHERE ${cond}
        RETURNING id, name, slug
      `;
      if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
      return res.status(200).json({ ok: true, data: row });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    return err(res, e);
  }
}
