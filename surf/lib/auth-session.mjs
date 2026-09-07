import crypto from 'node:crypto';

export const SESSION_COOKIE = 'msp_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEVELOPMENT_SECRET = 'dev-insecure-session-secret';
const MAX_SESSION_LENGTH = 8192;
const CLOCK_SKEW_SECONDS = 60;

// Keep the existing payload.signature format so unexpired logins survive deployment.
export function createSessionCodec({ secret, production = true, now = Date.now } = {}) {
  if (production && (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret.trim(), 'utf8') < 32 ||
    secret.trim() === DEVELOPMENT_SECRET
  )) {
    throw new Error('SESSION_SECRET must be configured with at least 32 bytes in production');
  }
  const key = secret || DEVELOPMENT_SECRET;
  const attributes = `Path=/; HttpOnly; SameSite=Lax${production ? '; Secure' : ''}`;
  const sign = (value) => crypto.createHmac('sha256', key).update(value).digest();

  function read(cookieHeader) {
    if (typeof cookieHeader !== 'string') return null;
    // Parse only our cookie. A malformed unrelated cookie must not crash authentication.
    const matches = cookieHeader.split(';').map((part) => part.trim())
      .filter((part) => part.slice(0, part.indexOf('=')) === SESSION_COOKIE);
    if (matches.length !== 1) return null;
    try {
      const raw = decodeURIComponent(matches[0].slice(SESSION_COOKIE.length + 1));
      if (raw.length > MAX_SESSION_LENGTH) return null;
      const parts = raw.split('.');
      if (parts.length !== 2) return null;
      const [encoded, signature] = parts;
      if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== 32 || actual.toString('base64url') !== signature) return null;
      if (!crypto.timingSafeEqual(sign(encoded), actual)) return null;
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      const time = Math.floor(now() / 1000);
      if (!Number.isSafeInteger(payload.iat) || payload.iat <= 0 ||
          payload.iat > time + CLOCK_SKEW_SECONDS || time - payload.iat >= SESSION_TTL_SECONDS) return null;
      return payload;
    } catch {
      return null;
    }
  }

  function issue(payload) {
    const encoded = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(now() / 1000) })).toString('base64url');
    return `${SESSION_COOKIE}=${encoded}.${sign(encoded).toString('base64url')}; ${attributes}; Max-Age=${SESSION_TTL_SECONDS}`;
  }

  return {
    read,
    issue,
    clear: () => `${SESSION_COOKIE}=; ${attributes}; Max-Age=0`,
  };
}
