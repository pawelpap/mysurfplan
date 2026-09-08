import { sql } from "../../../lib/db";
import { requireMutation } from "../../../lib/request-security.mjs";
import { clientNetwork, loginBuckets, consumeLoginAttempt } from "../../../lib/login-limits.mjs";
import {
  normalizeEmail,
  setUserAuthSession,
  verifyPassword,
} from "../../../lib/auth";

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
const DUMMY_HASH = 'msp-scrypt-v1$16384$8$1$BwcHBwcHBwcHBwcHBwcHBw$LJDREFzSy_Scn3GoIZAx4GV9IAuVZNT5EwalTTduW95H2NRFQ1dqh5DSbjFaz_gat9OxGOfpP6_I77oyEaUKCw';
const invalid = (res) => res.status(401).json({ok:false,error:'Invalid email, username or password'});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!requireMutation(req, res)) return;

  try {
    const { email, password } = req.body || {};
    const normalizedIdentifier = normalizeEmail(email);
    const buckets = loginBuckets(normalizedIdentifier, clientNetwork(req),
      process.env.SESSION_SECRET || (process.env.NODE_ENV === 'development' ? 'development-only-login-rate-secret' : ''));
    // Reject exhausted networks before creating counters for more guessed identifiers.
    let limit = await consumeLoginAttempt(sql, buckets.slice(0, 1));
    if (limit.allowed) limit = await consumeLoginAttempt(sql, buckets.slice(1));
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retrySeconds));
      return res.status(429).json({ok:false,error:'Too many login attempts. Please wait and try again.'});
    }
    if (!normalizedIdentifier || normalizedIdentifier.length > 320 || typeof password !== 'string' || password.length > 256)
      return invalid(res);

    const rows = await sql`
      SELECT
        u.id,
        u.school_id,
        u.name,
        u.family_name,
        u.photo_url,
        u.description,
        u.email,
        u.phone,
        u.role,
        u.password_hash,
        s.slug AS school_slug
      FROM users u
      LEFT JOIN schools s ON s.id = u.school_id AND s.deleted_at IS NULL
      WHERE (lower(u.email) = ${normalizedIdentifier} OR lower(u.username) = ${normalizedIdentifier})
        AND u.deleted_at IS NULL AND u.disabled_at IS NULL
        AND (u.role::text IN ('admin', 'platform_admin') OR s.id IS NOT NULL)
      LIMIT 1
    `;
    const user = rows[0];
    // Missing, disabled and deleted accounts perform the same password work.
    const valid = await verifyPassword(password, user?.password_hash || DUMMY_HASH);

    if (!user || !valid) return invalid(res);

    await sql`
      UPDATE users
      SET last_login_at = now(), updated_at = now()
      WHERE id = ${user.id}
    `;

    const session = await setUserAuthSession(res, user);
    return res.status(200).json({
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
    console.error("login error:", { code: err?.code, status: err?.statusCode });
    if (err?.statusCode === 401) return invalid(res);
    return res.status(503).json({ok:false,error:'Login is temporarily unavailable. Please try again.'});
  }
}
