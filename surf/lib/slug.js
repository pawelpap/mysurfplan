// Helpers to resolve school by slug
import { sql } from './db';

export async function getSchoolBySlug(slug) {
  const rows = await sql`
    SELECT id, name, slug
    FROM schools
    WHERE slug = ${slug} AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function requireSchoolId(slug) {
  const school = await getSchoolBySlug(slug);
  if (!school) {
    const err = new Error('School not found');
    err.statusCode = 404;
    throw err;
  }
  return school.id;
}
