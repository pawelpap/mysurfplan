import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_LIMITS = { pair: 10, identifier: 40, network: 80 };

export function networkIdentity(address) {
  if (isIP(address) === 4) return address;
  if (isIP(address) !== 6) return 'unknown';
  const compact = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [left, right] = compact.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const full = right === undefined ? a : [...a, ...Array(8-a.length-b.length).fill('0'), ...b];
  const parts = full.map(x => parseInt(x, 16));
  if (parts.slice(0,5).every(x => x === 0) && parts[5] === 65535)
    return [parts[6] >> 8, parts[6] & 255, parts[7] >> 8, parts[7] & 255].join('.');
  // Group IPv6 privacy addresses from one /64 rather than allowing trivial rotation.
  return parts.slice(0,4).map(x => x.toString(16)).join(':') + '::/64';
}

export function clientNetwork(req, env = process.env) {
  // Only the Vercel proxy is trusted to supply a forwarding header.
  const address = env.VERCEL === '1'
    ? req.headers?.['x-vercel-forwarded-for']
    : req.socket?.remoteAddress;
  return typeof address === 'string' ? networkIdentity(address.trim()) : 'unknown';
}

export function loginBuckets(identifier, network, secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32)
    throw new Error('Login rate-limit secret is unavailable');
  const digest = (kind, values) => createHmac('sha256', secret)
    .update(JSON.stringify(['login-rate-v1', kind, ...values])).digest('hex');
  const normalized = typeof identifier === 'string' && identifier.length <= 320
    ? identifier.trim().toLowerCase() : '';
  return [
    {key:digest('network',[network]),limit:LOGIN_LIMITS.network},
    {key:digest('identifier',[normalized]),limit:LOGIN_LIMITS.identifier},
    {key:digest('pair',[network,normalized]),limit:LOGIN_LIMITS.pair},
  ];
}

// One atomic UPSERT counts attempts before password work across all server instances.
export async function consumeLoginAttempt(sql, buckets) {
  const rows = await sql`
    WITH input AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(buckets)}::jsonb) AS b(key text, "limit" integer)
    ), cleanup AS (
      DELETE FROM auth_login_limits WHERE key IN (
        SELECT key FROM auth_login_limits WHERE expires_at < now() - interval '24 hours'
        AND key NOT IN (SELECT key FROM input)
        ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED
      )
    ), counted AS (
      INSERT INTO auth_login_limits(key, attempts, attempt_limit, expires_at)
      SELECT key, 1, "limit", now() + ${LOGIN_WINDOW_SECONDS} * interval '1 second'
      FROM input ORDER BY key
      ON CONFLICT(key) DO UPDATE SET
        attempts = CASE WHEN auth_login_limits.expires_at <= now() THEN 1
          ELSE LEAST(auth_login_limits.attempts + 1, EXCLUDED.attempt_limit + 1) END,
        attempt_limit = EXCLUDED.attempt_limit,
        expires_at = CASE WHEN auth_login_limits.expires_at <= now() THEN EXCLUDED.expires_at
          ELSE auth_login_limits.expires_at END
      RETURNING attempts, attempt_limit, expires_at
    )
    SELECT bool_and(attempts <= attempt_limit) AS allowed,
      COALESCE(MAX(CEIL(EXTRACT(EPOCH FROM expires_at - now())))
        FILTER (WHERE attempts > attempt_limit), 0)::integer AS retry_seconds
    FROM counted
  `;
  if (typeof rows[0]?.allowed !== 'boolean') throw new Error('Login rate-limit storage unavailable');
  return {allowed:rows[0].allowed,retrySeconds:Math.max(1,rows[0].retry_seconds)};
}
