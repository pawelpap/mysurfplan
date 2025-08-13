// pages/api/schools/index.js
import { sql } from '@vercel/postgres';

function toSlug(s) {
  return s
    ?.toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT id, name, slug, contact_email, created_at, updated_at
        FROM schools
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100;
      `;
      return res.json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { name, slug: slugFromClient, contact_email } = req.body || {};

      if (!name || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'Name is required' });
      }

      // We must NOT try to write to a GENERATED ALWAYS column.
      // Let Postgres compute slug. If your schema makes slug from name,
      // just omit it from the insert.
      const result = await sql`
        INSERT INTO schools (name, contact_email)
        VALUES (${name.trim()}, ${contact_email || null})
        RETURNING id, name, slug, contact_email, created_at, updated_at;
      `;

      return res.status(201).json({ ok: true, data: result.rows[0] });
    }

    if (req.method === 'DELETE') {
      const { id, slug } = req.query;
      if (!id && !slug) {
        return res.status(400).json({ ok: false, error: 'id or slug is required' });
      }

      let q;
      if (id) {
        q = sql`UPDATE schools SET deleted_at = now() WHERE id = ${id} AND deleted_at IS NULL RETURNING id`;
      } else {
        q = sql`UPDATE schools SET deleted_at = now() WHERE slug = ${slug} AND deleted_at IS NULL RETURNING id`;
      }
      const { rowCount } = await q;

      return res.json({ ok: true, deleted: rowCount });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` });
  } catch (e) {
    // Return detail to make debugging in staging easier
    return res.status(500).json({ ok: false, error: 'Server error', detail: e.message });
  }
}
