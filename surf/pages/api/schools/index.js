// surf/pages/api/schools/index.js
import { sql } from '@vercel/postgres';

function send(res, status, body) {
  res.status(status).json(body);
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // non-alnum -> hyphen
    .replace(/^-+|-+$/g, '')       // trim leading/trailing -
    .slice(0, 80);                 // sensible max length
}

export default async function handler(req, res) {
  try {
    // Quick health check of env (useful during staging setup)
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) {
      return send(res, 500, {
        ok: false,
        error:
          "Missing database connection string. Set POSTGRES_URL (or DATABASE_URL) in Vercel Project → Settings → Environment Variables.",
      });
    }

    if (req.method === 'GET') {
      // List all schools (basic fields; extend as needed)
      const { rows } = await sql`
        SELECT id, name, slug, contact_email, created_at
        FROM schools
        ORDER BY created_at DESC
      `;
      return send(res, 200, { ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { name, slug, contactEmail } = req.body || {};

      if (!name || typeof name !== 'string' || !name.trim()) {
        return send(res, 400, { ok: false, error: 'Name is required.' });
      }

      const finalSlug = (slug && slugify(slug)) || slugify(name);
      if (!finalSlug) {
        return send(res, 400, { ok: false, error: 'Unable to derive a valid slug.' });
      }

      try {
        const { rows } = await sql`
          INSERT INTO schools (name, slug, contact_email)
          VALUES (${name.trim()}, ${finalSlug}, ${contactEmail || null})
          RETURNING id, name, slug, contact_email, created_at
        `;
        return send(res, 201, { ok: true, data: rows[0] });
      } catch (err) {
        // Unique violation (e.g., slug already exists)
        if (err && (err.code === '23505' || /duplicate key/i.test(err.message))) {
          return send(res, 409, {
            ok: false,
            error: `Slug "${finalSlug}" already exists. Please choose another.`,
          });
        }
        // Other SQL errors
        return send(res, 500, {
          ok: false,
          error: 'Database error creating school.',
          detail: err?.message,
        });
      }
    }

    // Method not allowed
    res.setHeader('Allow', ['GET', 'POST']);
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (e) {
    // Last‑resort catch — return a readable message instead of a generic 500
    return send(res, 500, { ok: false, error: 'Server error', detail: e?.message });
  }
}
