// surf/pages/api/schools/index.js
import { sql } from '../../../lib/db';

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
      const { name, contactEmail } = await readJSON(req);
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
      const body = await readJSON(req).catch(() => ({}));
      const id = body?.id || req.query.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: 'Missing id' });
      }

      await sql`DELETE FROM schools WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('schools api error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', detail: cleanErr(err) });
  }
}

async function readJSON(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function cleanErr(e) {
  return e?.detail || e?.message || String(e);
}
