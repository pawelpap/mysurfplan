import { sql } from '../../../lib/db';
import { normalizeEmail, setUserAuthSession, verifyPassword } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || typeof password !== 'string') {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const rows = await sql`
      SELECT
        u.id,
        u.school_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.password_hash,
        s.slug AS school_slug
      FROM users u
      LEFT JOIN schools s ON s.id = u.school_id AND s.deleted_at IS NULL
      WHERE lower(u.email) = ${normalizedEmail}
        AND u.deleted_at IS NULL
      LIMIT 1
    `;
    const user = rows[0];
    const valid = user?.password_hash
      ? await verifyPassword(password, user.password_hash)
      : false;

    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    await sql`
      UPDATE users
      SET last_login_at = now(), updated_at = now()
      WHERE id = ${user.id}
    `;

    const session = setUserAuthSession(res, user);
    return res.status(200).json({
      ok: true,
      data: {
        session,
        user: {
          id: user.id,
          schoolId: user.school_id,
          schoolSlug: user.school_slug,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
