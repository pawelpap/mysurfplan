import crypto from 'node:crypto';
import { SESSION_TTL_SECONDS } from './auth-session.mjs';

export const sessionTokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const validSessionToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

// Inject the SQL executor so these exact queries can be tested on an isolated database.
export function createSessionStore(sql) {
  return {
    async create(userId, verifiedPasswordHash) {
      const token = crypto.randomBytes(32).toString('base64url');
      const hash = sessionTokenHash(token);
      const rows = await sql`
        WITH eligible AS MATERIALIZED (
          SELECT u.id, u.auth_version
          FROM users u LEFT JOIN schools sc ON sc.id = u.school_id
          WHERE u.id = ${userId} AND u.password_hash = ${verifiedPasswordHash}
            AND u.deleted_at IS NULL AND u.disabled_at IS NULL
            AND (u.role::text IN ('admin', 'platform_admin') OR sc.deleted_at IS NULL AND sc.id IS NOT NULL)
          FOR SHARE OF u
        ), cleanup AS (
          DELETE FROM auth_sessions WHERE token_hash IN (
            SELECT token_hash FROM auth_sessions WHERE expires_at <= now() ORDER BY expires_at LIMIT 500
          )
        )
        INSERT INTO auth_sessions (token_hash, user_id, auth_version, expires_at)
        SELECT ${hash}, id, auth_version, now() + ${SESSION_TTL_SECONDS} * interval '1 second' FROM eligible
        RETURNING user_id
      `;
      return rows.length ? token : null;
    },
    async find(token) {
      if (!validSessionToken(token)) return null;
      const rows = await sql`
        SELECT u.id, u.school_id, u.role, u.name, u.family_name, u.email, u.phone,
               u.photo_url, u.description, sc.slug AS school_slug
        FROM auth_sessions a JOIN users u ON u.id = a.user_id
        LEFT JOIN schools sc ON sc.id = u.school_id
        WHERE a.token_hash = ${sessionTokenHash(token)}
          AND a.revoked_at IS NULL AND a.expires_at > now()
          AND a.auth_version = u.auth_version
          AND u.deleted_at IS NULL AND u.disabled_at IS NULL
          AND (u.role::text IN ('admin', 'platform_admin') OR sc.deleted_at IS NULL AND sc.id IS NOT NULL)
        LIMIT 1
      `;
      return rows[0] || null;
    },
    async revoke(token) {
      if (!validSessionToken(token)) return;
      await sql`UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = ${sessionTokenHash(token)}`;
    },
    async revokeAll(userId) {
      // The user epoch also covers logins racing this operation. Creation locks this row.
      await sql`
        WITH changed AS (
          UPDATE users SET auth_version = auth_version + 1 WHERE id = ${userId} RETURNING id
        )
        UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now())
        WHERE user_id IN (SELECT id FROM changed)
      `;
    },
  };
}
