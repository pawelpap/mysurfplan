import crypto from 'crypto';
import { sql } from './db';

const SESSION_COOKIE = 'msp_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-session-secret';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const ROLES = new Set(['admin', 'school_admin', 'coach', 'student']);

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function parseCookies(header = '') {
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return acc;
      const key = part.slice(0, idx);
      const value = part.slice(idx + 1);
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function encodeSession(payload) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function decodeSession(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export async function resolveSchoolScope(school) {
  if (!school || typeof school !== 'string') return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    school
  );
  if (isUuid) {
    const byId = await sql`
      SELECT id, slug, name
      FROM schools
      WHERE id = ${school} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (byId.length) return byId[0];
  }

  const bySlug = await sql`
    SELECT id, slug, name
    FROM schools
    WHERE slug = ${school} AND deleted_at IS NULL
    LIMIT 1
  `;
  return bySlug[0] || null;
}

export function getAuthSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const payload = decodeSession(cookies[SESSION_COOKIE]);
  if (!payload || !payload.role || !ROLES.has(payload.role)) return null;
  return payload;
}

export function clearAuthSession(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export async function setAuthSession(res, input) {
  const role = typeof input?.role === 'string' ? input.role : '';
  if (!ROLES.has(role)) {
    const err = new Error('Invalid role');
    err.statusCode = 400;
    throw err;
  }

  let schoolId = null;
  let schoolSlug = null;
  if (input?.school) {
    const scope = await resolveSchoolScope(input.school);
    if (!scope) {
      const err = new Error('School not found');
      err.statusCode = 404;
      throw err;
    }
    schoolId = scope.id;
    schoolSlug = scope.slug;
  }

  if (role !== 'admin' && !schoolId) {
    const err = new Error('School is required for this role');
    err.statusCode = 400;
    throw err;
  }

  const studentEmail = normalizeEmail(input?.student?.email);
  const studentName = typeof input?.student?.name === 'string' ? input.student.name.trim() : '';
  const payload = {
    role,
    schoolId,
    schoolSlug,
    studentEmail: studentEmail || null,
    studentName: studentName || null,
    iat: Math.floor(Date.now() / 1000),
  };

  const cookieValue = encodeSession(payload);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(
      cookieValue
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
  );

  return payload;
}

export function requireAuth(req, res, options = {}) {
  const session = getAuthSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return null;
  }

  if (options.roles?.length && !options.roles.includes(session.role)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return null;
  }

  if (options.schoolId && session.role !== 'admin' && session.schoolId !== options.schoolId) {
    res.status(403).json({ ok: false, error: 'Forbidden for this school' });
    return null;
  }

  if (options.studentEmail && session.role === 'student') {
    if (normalizeEmail(options.studentEmail) !== normalizeEmail(session.studentEmail)) {
      res.status(403).json({ ok: false, error: 'Forbidden for this student' });
      return null;
    }
  }

  return session;
}
