import crypto from 'crypto';
import { promisify } from 'util';
import { sql } from './db';
import { createSessionCodec } from './auth-session.mjs';
import { createSessionStore, validSessionToken } from './auth-store.mjs';
import { requireMutation } from './request-security.mjs';

const sessionCodec = createSessionCodec({
  secret: process.env.SESSION_SECRET,
  production: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',
});
const sessionStore = createSessionStore(sql);
const requestSessions = new WeakMap();
const ROLES = new Set(['admin', 'platform_admin', 'school_admin', 'coach', 'student']);
const scryptAsync = promisify(crypto.scrypt);

const PASSWORD_HASH_VERSION = 'msp-scrypt-v1';
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 256;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const PASSWORD_SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function normalizePhone(phone) {
  return typeof phone === 'string' ? phone.trim() : '';
}

function isGlobalAdmin(role) {
  return role === 'admin' || role === 'platform_admin';
}

export function validatePassword(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`;
  }
  return '';
}

export async function hashPassword(password) {
  const validationError = validatePassword(password);
  if (validationError) {
    const err = new Error(validationError);
    err.statusCode = 400;
    throw err;
  }

  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = await scryptAsync(
    password,
    salt,
    PASSWORD_KEY_BYTES,
    PASSWORD_SCRYPT_OPTIONS
  );

  return [
    PASSWORD_HASH_VERSION,
    PASSWORD_SCRYPT_OPTIONS.N,
    PASSWORD_SCRYPT_OPTIONS.r,
    PASSWORD_SCRYPT_OPTIONS.p,
    salt.toString('base64url'),
    Buffer.from(derivedKey).toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string') return false;

  const [version, n, r, p, saltValue, hashValue] = passwordHash.split('$');
  if (version !== PASSWORD_HASH_VERSION || !n || !r || !p || !saltValue || !hashValue) {
    return false;
  }

  const expected = Buffer.from(hashValue, 'base64url');
  if (!expected.length) return false;

  try {
    const actual = await scryptAsync(password, Buffer.from(saltValue, 'base64url'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PASSWORD_SCRYPT_OPTIONS.maxmem,
    });
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(actual), expected)
    );
  } catch {
    return false;
  }
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

export async function getAuthSession(req) {
  if (!requestSessions.has(req)) {
    requestSessions.set(req, (async () => {
      const cookie = sessionCodec.read(req.headers?.cookie);
      // Legacy stateless cookies must log in once; they cannot be safely revoked.
      if (!validSessionToken(cookie?.sid)) return null;
      const user = await sessionStore.find(cookie.sid);
      if (!user || !ROLES.has(user.role)) return null;
      return userSessionPayload(user);
    })());
  }
  return requestSessions.get(req);
}

export async function clearAuthSession(req, res, { all = false } = {}) {
  if (all) {
    const session = await getAuthSession(req);
    if (!session) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }
    await sessionStore.revokeAll(session.userId);
  } else {
    const cookie = sessionCodec.read(req.headers?.cookie);
    if (validSessionToken(cookie?.sid)) await sessionStore.revoke(cookie.sid);
  }
  requestSessions.delete(req);
  res.setHeader('Set-Cookie', sessionCodec.clear());
}

export async function setUserAuthSession(res, user) {
  const token = await sessionStore.create(user.id, user.password_hash);
  if (!token) {
    const err = new Error('Please log in again.');
    err.statusCode = 401;
    throw err;
  }
  const current = await sessionStore.find(token);
  if (!current) {
    const err = new Error('Please log in again.');
    err.statusCode = 401;
    throw err;
  }
  res.setHeader('Set-Cookie', sessionCodec.issue({ sid: token }));
  return userSessionPayload(current);
}

function userSessionPayload(user) {
  const role = typeof user?.role === 'string' ? user.role : '';
  if (!ROLES.has(role)) {
    const err = new Error('Invalid role');
    err.statusCode = 400;
    throw err;
  }

  const email = normalizeEmail(user?.email);
  const name = typeof user?.name === 'string' ? user.name.trim() : '';
  const familyName = typeof user?.family_name === 'string' ? user.family_name.trim() : '';
  const photoUrl = typeof user?.photo_url === 'string' ? user.photo_url.trim() : '';
  const description = typeof user?.description === 'string' ? user.description.trim() : '';
  const payload = {
    role,
    userId: user.id,
    schoolId: user.school_id || null,
    schoolSlug: user.school_slug || null,
    email: email || null,
    name: name || null,
    familyName: familyName || null,
    photoUrl: photoUrl || null,
    description: description || null,
    phone: normalizePhone(user.phone) || null,
    studentEmail: role === 'student' ? email || null : null,
    studentName: role === 'student' ? name || null : null,
  };
  return payload;
}

export async function requireAuth(req, res, options = {}) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!requireMutation(req, res)) return null;
  let session;
  try {
    session = await getAuthSession(req);
  } catch {
    res.status(503).json({ ok: false, error: 'Account access is temporarily unavailable. Please try again.' });
    return null;
  }
  if (!session) {
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return null;
  }

  if (options.roles?.length && !isGlobalAdmin(session.role) && !options.roles.includes(session.role)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return null;
  }

  if (options.schoolId && !isGlobalAdmin(session.role) && session.schoolId !== options.schoolId) {
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
