import { sql } from '../../../lib/db';
import {
  getAuthSession,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  requireAuth,
  resolveSchoolScope,
  validatePassword,
} from '../../../lib/auth';

const USER_ROLES = new Set(['platform_admin', 'school_admin', 'coach', 'student']);

function isPlatformAdmin(session) {
  return session?.role === 'platform_admin' || session?.role === 'admin';
}

function cleanUser(row) {
  return {
    id: row.id,
    schoolId: row.school_id,
    schoolSlug: row.school_slug,
    schoolName: row.school_name,
    name: row.name,
    familyName: row.family_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

async function resolveTargetSchool(session, school, role) {
  if (role === 'platform_admin') return null;
  if (!isPlatformAdmin(session)) return session.schoolId;
  const scope = await resolveSchoolScope(school);
  return scope?.id || null;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (!requireAuth(req, res, { roles: ['school_admin'] })) return;
      const session = getAuthSession(req);
      const school = Array.isArray(req.query.school) ? req.query.school[0] : req.query.school;

      let rows;
      if (isPlatformAdmin(session)) {
        if (school) {
          const scope = await resolveSchoolScope(school);
          if (!scope) return res.status(404).json({ ok: false, error: 'School not found' });
          rows = await sql`
            SELECT u.id, u.school_id, s.slug AS school_slug, s.name AS school_name,
                   u.name, u.family_name, u.email, u.phone, u.role, u.created_at, u.updated_at, u.last_login_at
            FROM users u
            LEFT JOIN schools s ON s.id = u.school_id
            WHERE u.deleted_at IS NULL AND u.school_id = ${scope.id}
            ORDER BY u.created_at DESC
          `;
        } else {
          rows = await sql`
            SELECT u.id, u.school_id, s.slug AS school_slug, s.name AS school_name,
                   u.name, u.family_name, u.email, u.phone, u.role, u.created_at, u.updated_at, u.last_login_at
            FROM users u
            LEFT JOIN schools s ON s.id = u.school_id
            WHERE u.deleted_at IS NULL
            ORDER BY u.created_at DESC
          `;
        }
      } else {
        rows = await sql`
          SELECT u.id, u.school_id, s.slug AS school_slug, s.name AS school_name,
                 u.name, u.family_name, u.email, u.phone, u.role, u.created_at, u.updated_at, u.last_login_at
          FROM users u
          LEFT JOIN schools s ON s.id = u.school_id
          WHERE u.deleted_at IS NULL AND u.school_id = ${session.schoolId}
          ORDER BY u.created_at DESC
        `;
      }

      return res.status(200).json({ ok: true, data: rows.map(cleanUser) });
    }

    if (req.method === 'POST') {
      if (!requireAuth(req, res, { roles: ['school_admin'] })) return;
      const session = getAuthSession(req);
      const { name, familyName, family_name, email, phone, role, school, password } = req.body || {};
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      const trimmedFamilyName =
        typeof familyName === 'string'
          ? familyName.trim()
          : typeof family_name === 'string'
          ? family_name.trim()
          : '';
      const normalizedEmail = normalizeEmail(email);
      const normalizedPhone = normalizePhone(phone);
      const requestedRole = typeof role === 'string' ? role : '';

      if (!trimmedName) return res.status(400).json({ ok: false, error: 'Name is required' });
      if (!trimmedFamilyName) return res.status(400).json({ ok: false, error: 'Family name is required' });
      if (!normalizedEmail) return res.status(400).json({ ok: false, error: 'Email is required' });
      if (!USER_ROLES.has(requestedRole)) {
        return res.status(400).json({ ok: false, error: 'Invalid role' });
      }
      if (!isPlatformAdmin(session) && requestedRole === 'platform_admin') {
        return res.status(403).json({ ok: false, error: 'Only platform admins can create platform admins' });
      }

      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ ok: false, error: passwordError });

      const schoolId = await resolveTargetSchool(session, school, requestedRole);
      if (requestedRole !== 'platform_admin' && !schoolId) {
        return res.status(400).json({ ok: false, error: 'School is required for this role' });
      }

      const passwordHash = await hashPassword(password);
      const rows = await sql`
        INSERT INTO users (school_id, name, family_name, email, phone, role, password_hash)
        VALUES (${schoolId}, ${trimmedName}, ${trimmedFamilyName}, ${normalizedEmail}, ${normalizedPhone || null}, ${requestedRole}, ${passwordHash})
        RETURNING id, school_id, name, family_name, email, phone, role, created_at, updated_at, last_login_at
      `;
      return res.status(201).json({ ok: true, data: cleanUser(rows[0]) });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('users api error:', err);
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, error: 'User already exists' });
    }
    return res.status(err?.statusCode || 500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
