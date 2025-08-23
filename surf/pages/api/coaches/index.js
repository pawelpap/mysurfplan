// surf/pages/api/coaches/index.js
import { sql } from '../../../lib/db';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { school } = req.query;
      if (!school) {
        return res.status(400).json({ ok: false, error: 'Missing school (slug or id)' });
      }

      const schoolRow = await fetchSchool(school);
      if (!schoolRow) {
        return res.status(404).json({ ok: false, error: 'School not found' });
      }

      const rows = await sql`
        SELECT id, name, email, created_at
        FROM coaches
        WHERE school_id = ${schoolRow.id}
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { school, name, email } = await readJSON(req);
      if (!school) return res.status(400).json({ ok: false, error: 'Missing school (slug or id)' });
      if (!name) return res.status(400).json({ ok: false, error: 'Missing name' });

      const schoolRow = await fetchSchool(school);
      if (!schoolRow) return res.status(404).json({ ok: false, error: 'School not found' });

      const rows = await sql`
        INSERT INTO coaches (school_id, name, email)
        VALUES (${schoolRow.id}, ${name}, ${email || null})
        RETURNING id, name, email, created_at
      `;
      return res.status(201).json({ ok: true, data: rows[0] });
    }

    if (req.method === 'DELETE') {
      const body = await readJSON(req).catch(() => ({}));
      const id = body?.id || req.query.id;
      if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

      await sql`DELETE FROM coaches WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('coaches api error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: cleanErr(err) });
  }
}

async function fetchSchool(slugOrId) {
  // Try id (uuid) first, then slug
  const byId = await sql`SELECT id, name, slug FROM schools WHERE id = ${slugOrId} AND deleted_at IS NULL`;
  if (byId.length) return byId[0];
  const bySlug = await sql`SELECT id, name, slug FROM schools WHERE slug = ${slugOrId} AND deleted_at IS NULL`;
  return bySlug[0] || null;
}

async function readJSON(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function cleanErr(e) {
  return e?.detail || e?.message || String(e);
}
