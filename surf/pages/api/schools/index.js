import { requireMutation } from '../../../lib/request-security.mjs';
// surf/pages/api/schools/index.js
import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!requireMutation(req, res)) return;
  try {
    if (req.method === 'GET') {
      if (req.query.public === '1') {
        res.setHeader('Cache-Control', 'no-store');
        const rows = await sql`SELECT id,name,slug FROM schools s
          WHERE school_is_operational(s) AND (workspace_kind='legacy' OR listing_status='published')
          ORDER BY name,id`;
        return res.status(200).json({ ok: true, data: rows });
      }
      const session = await requireAuth(req, res);
      if (!session) return;
      const rows = await sql`
        SELECT id, name, slug, contact_email
        FROM schools s
        WHERE school_is_operational(s) AND (account_is_platform(${session.userId}::uuid) OR
          EXISTS(SELECT 1 FROM account_school_access a WHERE a.user_id=${session.userId}::uuid AND a.school_id=s.id AND a.school_open AND a.status IN ('active','customer')))
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      if (!(await requireAuth(req, res, { roles: ['admin'] }))) return;
      const body = await getBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['name','contactEmail'].includes(key)))
        return res.status(400).json({ ok: false, error: 'Invalid school fields' });
      const { name, contactEmail } = body;
      if (typeof name !== 'string' || name.trim().length > 160 || (contactEmail !== undefined && (typeof contactEmail !== 'string' || contactEmail.length > 254)))
        return res.status(400).json({ ok: false, error: 'Invalid school details' });
      if (!name || !name.trim()) {
        return res.status(400).json({ ok: false, error: 'Missing name' });
      }

      // slug is a generated column in your schema – do NOT insert it
      const rows = await sql`
        INSERT INTO schools (name, contact_email)
        VALUES (${name.trim()}, ${contactEmail || null})
        RETURNING id, name, slug, contact_email, created_at
      `;
      return res.status(201).json({ ok: true, data: rows[0] });
    }

    if (req.method === 'DELETE') {
      if (!(await requireAuth(req, res, { roles: ['admin'] }))) return;
      const body = await getBody(req).catch(() => ({}));
      const id = body?.id || req.query.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: 'Missing id' });
      }

      const rows = await sql`
        UPDATE schools
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${id} AND deleted_at IS NULL AND workspace_kind='legacy'
        RETURNING id
      `;
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: 'School not found' });
      }
      return res.status(200).json({ ok: true, data: { id: rows[0].id, deleted: true } });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('schools api error:', err);
    return res.status(500).json({ ok: false, error: 'Could not load or update schools. Please try again.' });
  }
}

async function readJSON(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function getBody(req) {
  if (req.body && Object.keys(req.body).length) return req.body;
  return readJSON(req);
}
