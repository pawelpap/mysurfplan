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

async function getEditableUser(id, session) {
  const rows = await sql`
    SELECT u.id, u.school_id, s.slug AS school_slug, s.name AS school_name,
           u.name, u.family_name, u.email, u.phone, u.role, u.created_at, u.updated_at, u.last_login_at
    FROM users u
    LEFT JOIN schools s ON s.id = u.school_id
    WHERE u.id = ${id} AND u.deleted_at IS NULL
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) return null;
  if (!isPlatformAdmin(session) && user.school_id !== session.schoolId) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return user;
}

async function resolveTargetSchool(session, school, role) {
  if (role === 'platform_admin') return null;
  if (!isPlatformAdmin(session)) return session.schoolId;
  const scope = await resolveSchoolScope(school);
  return scope?.id || null;
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing user id' });
  }

  try {
    if (!requireAuth(req, res, { roles: ['school_admin'] })) return;
    const session = getAuthSession(req);
    const existing = await getEditableUser(id, session);
    if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, data: cleanUser(existing) });
    }

    if (req.method === 'DELETE') {
      if (!isPlatformAdmin(session) && existing.role === 'platform_admin') {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      await sql`
        UPDATE users
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${id}
      `;
      return res.status(200).json({ ok: true, data: { id, deleted: true } });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = req.body || {};
      const nextName = body.name !== undefined ? String(body.name).trim() : existing.name;
      const nextFamilyName =
        body.familyName !== undefined
          ? String(body.familyName).trim()
          : body.family_name !== undefined
          ? String(body.family_name).trim()
          : existing.family_name || '';
      const nextEmail = body.email !== undefined ? normalizeEmail(body.email) : existing.email;
      const nextPhone = body.phone !== undefined ? normalizePhone(body.phone) : existing.phone;
      const nextRole = body.role !== undefined ? String(body.role) : existing.role;

      if (!nextName) return res.status(400).json({ ok: false, error: 'Name is required' });
      if (!nextFamilyName) return res.status(400).json({ ok: false, error: 'Family name is required' });
      if (!nextEmail) return res.status(400).json({ ok: false, error: 'Email is required' });
      if (!USER_ROLES.has(nextRole)) return res.status(400).json({ ok: false, error: 'Invalid role' });
      if (!isPlatformAdmin(session) && (nextRole === 'platform_admin' || existing.role === 'platform_admin')) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      const schoolId = await resolveTargetSchool(session, body.school ?? existing.school_slug ?? existing.school_id, nextRole);
      if (nextRole !== 'platform_admin' && !schoolId) {
        return res.status(400).json({ ok: false, error: 'School is required for this role' });
      }

      if (body.password) {
        const passwordError = validatePassword(body.password);
        if (passwordError) return res.status(400).json({ ok: false, error: passwordError });
        const passwordHash = await hashPassword(body.password);
        const rows = await sql`
          UPDATE users
          SET school_id = ${schoolId},
              name = ${nextName},
              family_name = ${nextFamilyName},
              email = ${nextEmail},
              phone = ${nextPhone || null},
              role = ${nextRole},
              password_hash = ${passwordHash},
              updated_at = now()
          WHERE id = ${id}
          RETURNING id, school_id, name, family_name, email, phone, role, created_at, updated_at, last_login_at
        `;
        return res.status(200).json({ ok: true, data: cleanUser(rows[0]) });
      }

      const rows = await sql`
        UPDATE users
        SET school_id = ${schoolId},
            name = ${nextName},
            family_name = ${nextFamilyName},
            email = ${nextEmail},
            phone = ${nextPhone || null},
            role = ${nextRole},
            updated_at = now()
        WHERE id = ${id}
        RETURNING id, school_id, name, family_name, email, phone, role, created_at, updated_at, last_login_at
      `;
      return res.status(200).json({ ok: true, data: cleanUser(rows[0]) });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('users/[id] api error:', err);
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, error: 'User already exists' });
    }
    return res.status(err?.statusCode || 500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
