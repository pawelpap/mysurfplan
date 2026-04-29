import crypto from 'crypto';
import { sql } from '../../../lib/db';
import {
  hashPassword,
  normalizeEmail,
  normalizePhone,
  setUserAuthSession,
  validatePassword,
} from '../../../lib/auth';

function tokenMatches(actual, expected) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const expectedToken = process.env.BOOTSTRAP_ADMIN_TOKEN;
  if (!expectedToken) {
    return res.status(404).json({ ok: false, error: 'Bootstrap is disabled' });
  }

  try {
    const { token, name, familyName, family_name, photoUrl, photo_url, description, email, phone, password } = req.body || {};
    if (!tokenMatches(token, expectedToken)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedFamilyName =
      typeof familyName === 'string'
        ? familyName.trim()
        : typeof family_name === 'string'
        ? family_name.trim()
        : '';
    const normalizedPhotoUrl =
      typeof photoUrl === 'string'
        ? photoUrl.trim()
        : typeof photo_url === 'string'
        ? photo_url.trim()
        : '';
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';
    const passwordError = validatePassword(password);
    if (!trimmedName) return res.status(400).json({ ok: false, error: 'Name is required' });
    if (!normalizedEmail) return res.status(400).json({ ok: false, error: 'Email is required' });
    if (passwordError) return res.status(400).json({ ok: false, error: passwordError });

    const existing = await sql`
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE deleted_at IS NULL
    `;
    if ((existing[0]?.count || 0) > 0) {
      return res.status(409).json({ ok: false, error: 'Bootstrap user already exists' });
    }

    const passwordHash = await hashPassword(password);
    const inserted = await sql`
      INSERT INTO users (school_id, name, family_name, photo_url, description, email, phone, role, password_hash, email_verified_at)
      VALUES (NULL, ${trimmedName}, ${trimmedFamilyName || null}, ${normalizedPhotoUrl || null}, ${normalizedDescription || null}, ${normalizedEmail}, ${normalizedPhone || null}, 'platform_admin', ${passwordHash}, now())
      RETURNING id, school_id, name, family_name, photo_url, description, email, phone, role, NULL::text AS school_slug
    `;
    const user = inserted[0];
    const session = setUserAuthSession(res, user);

    return res.status(201).json({
      ok: true,
      data: {
        session,
        user: {
          id: user.id,
          schoolId: user.school_id,
          schoolSlug: user.school_slug,
          name: user.name,
          familyName: user.family_name,
          photoUrl: user.photo_url,
          description: user.description,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error('bootstrap error:', err);
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, error: 'User already exists' });
    }
    return res.status(err?.statusCode || 500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
