// surf/pages/api/schools/[id].js
import { sql } from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, slug, contact_email, created_at, updated_at
        FROM schools
        WHERE id = ${id} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      return res.status(200).json({ ok: true, data: rows[0] });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, slug, contactEmail } = req.body || {};
      const fields = [];
      const values = [];

      if (name !== undefined) {
        fields.push(`name = $${fields.length + 1}`);
        values.push(name);
      }
      if (slug !== undefined) {
        fields.push(`slug = $${fields.length + 1}`);
        values.push(slug);
      }
      if (contactEmail !== undefined) {
        fields.push(`contact_email = $${fields.length + 1}`);
        values.push(contactEmail);
      }

      if (!fields.length) {
        return res.status(400).json({ ok: false, error: 'No updates provided.' });
      }

      try {
        const text = `
          UPDATE schools
          SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${fields.length + 1}
          RETURNING id, name, slug, contact_email, created_at, updated_at
        `;
        const rows = await sql(text, [...values, id]);
        if (!rows.length) {
          return res.status(404).json({ ok: false, error: 'Not found' });
        }
        return res.status(200).json({ ok: true, data: rows[0] });
      } catch (err) {
        if (err && err.code === '23505') {
          return res.status(409).json({ ok: false, error: 'Slug already exists.' });
        }
        throw err;
      }
    }

    if (req.method === 'DELETE') {
      const rows = await sql`DELETE FROM schools WHERE id = ${id} RETURNING id;`;
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      return res.status(200).json({ ok: true, data: { id, deleted: true } });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  } catch (err) {
    console.error('schools/[id] error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
