import { requireMutation } from '../../../lib/request-security.mjs';
// surf/pages/api/schools/[id].js
import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!requireMutation(req, res)) return;
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      if (!(await requireAuth(req, res, { roles: ['admin'] }))) return;
      const rows = await sql`
        SELECT id, name, slug, contact_email, created_at, updated_at
        FROM schools
        WHERE id = ${id} AND deleted_at IS NULL AND workspace_kind='legacy'
        LIMIT 1
      `;
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      return res.status(200).json({ ok: true, data: rows[0] });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!(await requireAuth(req, res, { roles: ['admin'] }))) return;
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => !['name','contactEmail'].includes(key)))
        return res.status(400).json({ ok: false, error: 'Invalid school fields' });
      const { name, contactEmail } = req.body;
      if ((name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 160)) || (contactEmail !== undefined && (typeof contactEmail !== 'string' || contactEmail.length > 254)))
        return res.status(400).json({ ok: false, error: 'Invalid school details' });
      const fields = [];
      const values = [];

      if (name !== undefined) {
        fields.push(`name = $${fields.length + 1}`);
        values.push(name);
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
          SET ${fields.join(', ')}, settings_revision=settings_revision+1, updated_at = NOW()
          WHERE id = $${fields.length + 1} AND deleted_at IS NULL AND workspace_kind='legacy'
          RETURNING id, name, slug, contact_email, created_at, updated_at
        `;
        const rows = await sql.query(text, [...values, id]);
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
      if (!(await requireAuth(req, res, { roles: ['admin'] }))) return;
      const rows = await sql`
        UPDATE schools
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${id} AND deleted_at IS NULL AND workspace_kind='legacy'
        RETURNING id;
      `;
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
