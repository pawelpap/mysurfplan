// surf/pages/api/coaches/index.js
import { sql } from '@vercel/postgres';

// Helpers
function bad(res, msg = 'Bad request', code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}
function ok(res, data) {
  return res.status(200).json({ ok: true, data });
}

// Convert either a school UUID or a slug to a school id
async function resolveSchoolId({ school_id, school }) {
  if (school_id) return school_id;
  if (!school) return null;
  const { rows } = await sql`
    SELECT id FROM schools
    WHERE (id::text = ${school} OR slug = ${school}) AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export default async function handler(req, res) {
  try {
    const method = req.method;

    // -------- GET /api/coaches?school=<slug|uuid> --------
    if (method === 'GET') {
      const { school_id, school } = req.query;
      const sid = await resolveSchoolId({ school_id, school });
      if (!sid) return ok(res, []); // no school filter -> empty list

      const { rows } = await sql`
        SELECT c.id, c.name, c.email, c.created_at
        FROM coaches c
        WHERE c.school_id = ${sid} AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC
      `;
      return ok(res, rows);
    }

    // -------- POST /api/coaches --------
    // body: { school: <slug|uuid> OR school_id, name, email? }
    if (method === 'POST') {
      const { school_id, school, name, email } = req.body || {};
      if (!name) return bad(res, 'name is required');

      const sid = await resolveSchoolId({ school_id, school });
      if (!sid) return bad(res, 'school or school_id is required');

      const { rows } = await sql`
        INSERT INTO coaches (school_id, name, email)
        VALUES (${sid}, ${name}, ${email ?? null})
        RETURNING id, school_id, name, email, created_at
      `;
      return ok(res, rows[0]);
    }

    // -------- PATCH /api/coaches --------
    // body: { id, name?, email? }
    if (method === 'PATCH') {
      const { id, name, email } = req.body || {};
      if (!id) return bad(res, 'id is required');
      if (!name && !email) return bad(res, 'nothing to update');

      const { rows } = await sql`
        UPDATE coaches
        SET
          name  = COALESCE(${name},  name),
          email = COALESCE(${email}, email)
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id, school_id, name, email, created_at, updated_at
      `;
      if (rows.length === 0) return bad(res, 'not found', 404);
      return ok(res, rows[0]);
    }

    // -------- DELETE /api/coaches?id=<uuid> --------
    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return bad(res, 'id is required');

      const { rows } = await sql`
        UPDATE coaches
        SET deleted_at = NOW()
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id
      `;
      if (rows.length === 0) return bad(res, 'not found', 404);
      return ok(res, true);
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return bad(res, 'Method not allowed', 405);
  } catch (err) {
    console.error('Coaches API error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
